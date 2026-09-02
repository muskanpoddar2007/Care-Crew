#!/usr/bin/env python3
"""Test runner / simulator for the chest-pain triage conversation flow."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, field
from functools import reduce
from typing import Any

from app.data.chest_pain_convos import CONVERSATIONS, patient_turns
from app.services.conversation import start_session, process_turn
from app.services import question_tree


# --------------------------------------------------------------------------
# Output formatting
# --------------------------------------------------------------------------

class Ansi:
    """ANSI color codes, disabled automatically when stdout isn't a TTY."""
    ENABLED = sys.stdout.isatty()

    @staticmethod
    def wrap(code: str, text: str) -> str:
        if not Ansi.ENABLED:
            return text
        return f"\033[{code}m{text}\033[0m"

    @classmethod
    def bold(cls, t): return cls.wrap("1", t)
    @classmethod
    def dim(cls, t): return cls.wrap("2", t)
    @classmethod
    def red(cls, t): return cls.wrap("31", t)
    @classmethod
    def green(cls, t): return cls.wrap("32", t)
    @classmethod
    def yellow(cls, t): return cls.wrap("33", t)
    @classmethod
    def cyan(cls, t): return cls.wrap("36", t)


def header(text: str, char: str = "=", width: int = 60) -> None:
    print(Ansi.bold(char * width))
    print(Ansi.bold(text))
    print(Ansi.bold(char * width))


def sub_header(text: str, width: int = 60) -> None:
    print(Ansi.dim("-" * width))
    print(Ansi.cyan(text))
    print(Ansi.dim("-" * width))


# --------------------------------------------------------------------------
# Dict-path helpers
# --------------------------------------------------------------------------

def get_nested(data: dict, dotted_path: str, default: Any = None) -> Any:
    """Safely walk a dotted path ('a.b.c') through nested dicts.

    Returns `default` the moment any intermediate key is missing or the
    current value isn't a dict — instead of silently returning {} and
    letting the caller misinterpret it as "found but empty".
    """
    def _step(node, key):
        if isinstance(node, dict) and key in node:
            return node[key]
        raise KeyError(dotted_path)

    try:
        return reduce(_step, dotted_path.split("."), data)
    except KeyError:
        return default


# --------------------------------------------------------------------------
# Data structures for reporting
# --------------------------------------------------------------------------

@dataclass
class SlotOutcome:
    slot: str
    patient_text: str
    value: Any = None
    evidence: Any = None
    found: bool = False
    red_flag: list | None = None


@dataclass
class CaseResult:
    title: str
    index: int
    slot_outcomes: list[SlotOutcome] = field(default_factory=list)
    expected_urgent: bool | None = None
    actual_urgent: bool | None = None
    red_flags: list = field(default_factory=list)
    error: str | None = None

    @property
    def slots_missing(self) -> list[str]:
        return [o.slot for o in self.slot_outcomes if not o.found]

    @property
    def urgency_correct(self) -> bool | None:
        if self.expected_urgent is None or self.error:
            return None
        return self.expected_urgent == self.actual_urgent


# --------------------------------------------------------------------------
# Core runner
# --------------------------------------------------------------------------

def build_slot_list(tree: dict) -> list[str]:
    keys = ("mandatory_slots", "screening_questions", "background_slots")
    return [item["slot"] for key in keys for item in tree.get(key, [])]


def run_convo(convo: dict, index: int, *, verbose: bool = True) -> CaseResult:
    result = CaseResult(
        title=convo.get("title", f"case #{index}"),
        index=index,
        expected_urgent=convo.get("expected_urgent"),
    )

    if verbose:
        header(f"CASE {index}: {result.title}")

    try:
        session = start_session("chest_pain")
        sid = session["session_id"]
        tree = question_tree.load_tree("chest_pain")
        slots = build_slot_list(tree)
        pats = patient_turns(convo)

        out = None
        for slot, answer in zip(slots, pats):
            out = process_turn(sid, answer, slot)
            state = out["state"]

            node = get_nested(state, slot, default={})
            found = isinstance(node, dict) and "value" in node
            outcome = SlotOutcome(
                slot=slot,
                patient_text=answer,
                value=node.get("value") if found else None,
                evidence=node.get("evidence") if found else None,
                found=found,
                red_flag=out.get("new_red_flags") or None,
            )
            result.slot_outcomes.append(outcome)

            if verbose:
                _print_slot_outcome(outcome)

        if out is not None:
            result.actual_urgent = out["is_urgent"]
            result.red_flags = out["state"].get("red_flags", [])

    except Exception as exc:  # keep the whole suite running even if one case blows up
        result.error = f"{type(exc).__name__}: {exc}"
        if verbose:
            print(Ansi.red(f"    !!! ERROR: {result.error}"))

    if verbose:
        _print_case_footer(result)

    return result


def _print_slot_outcome(o: SlotOutcome) -> None:
    print(f"[{o.slot}]")
    print(f"    patient : {o.patient_text[:70]}")
    if o.found:
        print(f"    value   : {o.value!r}")
        print(f"    evidence: {o.evidence!r}")
    else:
        print(Ansi.yellow("    value   : <not extracted>"))
    if o.red_flag:
        print(Ansi.red(f"    >>> RED FLAG: {o.red_flag}"))


def _print_case_footer(r: CaseResult) -> None:
    if r.error:
        print()
        return
    urgency_line = f"URGENT: {r.actual_urgent} | red_flags: {r.red_flags}"
    if r.urgency_correct is False:
        urgency_line += Ansi.red(f"  (expected {r.expected_urgent})")
    elif r.urgency_correct is True:
        urgency_line += Ansi.green("  (matches expected)")
    print(urgency_line)
    print()


# --------------------------------------------------------------------------
# Summary report
# --------------------------------------------------------------------------

def print_summary(results: list[CaseResult]) -> None:
    sub_header("SUMMARY")

    total = len(results)
    errored = [r for r in results if r.error]
    ok = [r for r in results if not r.error]

    total_slots = sum(len(r.slot_outcomes) for r in ok)
    missing_slots = sum(len(r.slots_missing) for r in ok)
    extracted_slots = total_slots - missing_slots

    urgency_checked = [r for r in ok if r.urgency_correct is not None]
    urgency_correct = [r for r in urgency_checked if r.urgency_correct]

    print(f"Cases run          : {total}")
    print(f"Cases errored       : {Ansi.red(str(len(errored))) if errored else 0}")

    if total_slots:
        pct = 100 * extracted_slots / total_slots
        color = Ansi.green if pct == 100 else (Ansi.yellow if pct >= 80 else Ansi.red)
        print(f"Slot extraction     : {extracted_slots}/{total_slots} ({color(f'{pct:.1f}%')})")

    if urgency_checked:
        pct = 100 * len(urgency_correct) / len(urgency_checked)
        color = Ansi.green if pct == 100 else (Ansi.yellow if pct >= 80 else Ansi.red)
        print(f"Urgency accuracy    : {len(urgency_correct)}/{len(urgency_checked)} ({color(f'{pct:.1f}%')})")
    else:
        print("Urgency accuracy    : n/a (no 'expected_urgent' set on any case)")

    if errored:
        print()
        print(Ansi.red("Errored cases:"))
        for r in errored:
            print(f"  - [{r.index}] {r.title}: {r.error}")

    missing_by_case = [(r, r.slots_missing) for r in ok if r.slots_missing]
    if missing_by_case:
        print()
        print(Ansi.yellow("Cases with missing slot extractions:"))
        for r, missing in missing_by_case:
            print(f"  - [{r.index}] {r.title}: {', '.join(missing)}")

    if urgency_checked:
        wrong = [r for r in urgency_checked if not r.urgency_correct]
        if wrong:
            print()
            print(Ansi.red("Urgency mismatches:"))
            for r in wrong:
                print(f"  - [{r.index}] {r.title}: expected={r.expected_urgent} actual={r.actual_urgent}")

    print()


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def resolve_cases(args: argparse.Namespace) -> list[tuple[int, dict]]:
    """Return list of (index, convo) pairs to run based on CLI args."""
    if args.list:
        return []  # handled separately

    if args.case is None:
        return list(enumerate(CONVERSATIONS))

    # Try index first
    try:
        idx = int(args.case)
    except ValueError:
        idx = None

    if idx is not None:
        if not (0 <= idx < len(CONVERSATIONS)):
            raise SystemExit(
                f"Case index {idx} out of range (0-{len(CONVERSATIONS) - 1})"
            )
        return [(idx, CONVERSATIONS[idx])]

    # Fall back to title substring match (case-insensitive)
    needle = args.case.lower()
    matches = [
        (i, c) for i, c in enumerate(CONVERSATIONS)
        if needle in c.get("title", "").lower()
    ]
    if not matches:
        raise SystemExit(f"No case found matching index or title: {args.case!r}")
    if len(matches) > 1:
        titles = ", ".join(f"[{i}] {c['title']}" for i, c in matches)
        raise SystemExit(f"Ambiguous match for {args.case!r}, be more specific: {titles}")
    return matches


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run chest-pain triage conversation simulations against test cases."
    )
    parser.add_argument(
        "case",
        nargs="?",
        default=None,
        help="Case index (e.g. 2) or title substring (e.g. 'radiating'). Omit to run all.",
    )
    parser.add_argument(
        "--list", action="store_true",
        help="List all available cases with their index and exit.",
    )
    parser.add_argument(
        "--quiet", action="store_true",
        help="Suppress per-turn output; show only the final summary.",
    )
    parser.add_argument(
        "--no-color", action="store_true",
        help="Disable ANSI colors even when attached to a TTY.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    if args.no_color:
        Ansi.ENABLED = False

    if args.list:
        for i, c in enumerate(CONVERSATIONS):
            print(f"[{i}] {c.get('title', '(untitled)')}")
        return 0

    cases = resolve_cases(args)
    results = [run_convo(c, i, verbose=not args.quiet) for i, c in cases]

    print_summary(results)

    # Non-zero exit code if anything failed — useful in CI.
    any_error = any(r.error for r in results)
    any_urgency_miss = any(r.urgency_correct is False for r in results)
    return 1 if (any_error or any_urgency_miss) else 0


if __name__ == "__main__":
    raise SystemExit(main())