import unittest
from app.services.conversation import start_session, process_turn


class TestDualModeConsultation(unittest.TestCase):
    def test_allopathic_cardiac_case(self):
        # 1. Start session -> language select
        res = start_session()
        self.assertEqual(res["stage"], "language_select")
        self.assertIn("English", res["quick_replies"])
        sid = res["session_id"]

        # 2. Select Hinglish
        res = process_turn(sid, "Hinglish", "language_select")
        self.assertEqual(res["stage"], "mode_select")
        self.assertIn("English Medicine (Allopathic) Mode", res["quick_replies"])

        # 3. Select Allopathic mode
        res = process_turn(sid, "English Medicine (Allopathic) Mode", "mode_select")
        self.assertEqual(res["stage"], "chief_complaint")

        # 4. Give cardiac chief complaint
        res = process_turn(sid, "Doctor, mere chest mein dard ho raha hai.", "chief_complaint")
        self.assertEqual(res["stage"], "branching")
        self.assertEqual(res["category"], "cardiac-pattern")

        # Walk through branching questions
        turns_done = 0
        forbidden_meds = ["aspirin", "sorbitrate", "paracetamol", "atorvastatin", "metoprolol", "antibiotic", "mg"]
        bot_texts = [res["next_question"]]

        while not res["is_complete"] and turns_done < 15:
            turns_done += 1
            slot = res["next_slot"]
            options = res.get("quick_replies")
            if options and len(options) > 0:
                ans = options[0]
            else:
                if "location" in slot:
                    ans = "Centre of the chest"
                elif "associated" in slot:
                    ans = "Haan, stairs chadhne pe saans phoolti hai aur pasina aata hai"
                elif "history" in slot:
                    ans = "Pehle 2 saal pehle problem hui thi, purani reports hain"
                else:
                    ans = "Nahi"

            res = process_turn(sid, ans, slot)
            bot_texts.append(res["next_question"])

        # Checks
        self.assertTrue(res["is_complete"], "Conversation should complete successfully")
        self.assertGreaterEqual(res["mcq_questions_asked"], 4, "Must ask at least 4 MCQ questions")

        # Check non-negotiable rules: no specific medicine names or doses prescribed
        full_conversation_bot_text = " ".join(bot_texts).lower()
        for med in forbidden_meds:
            self.assertNotIn(med, full_conversation_bot_text)

        # Check closes by handoff to booking/review
        self.assertTrue(
            any(w in bot_texts[-1].lower() for w in ("booking", "appointment", "review")),
            "Bot must close by handing off to doctor review or appointment booking",
        )

    def test_ayurveda_knee_pain_case(self):
        # 1. Start session
        res = start_session()
        sid = res["session_id"]

        # 2. Select English
        res = process_turn(sid, "English", "language_select")
        self.assertEqual(res["stage"], "mode_select")

        # 3. Select Ayurveda
        res = process_turn(sid, "Ayurveda Mode", "mode_select")
        self.assertEqual(res["stage"], "chief_complaint")

        # 4. Knee pain complaint
        res = process_turn(sid, "I have been having pain in my knees for three months", "chief_complaint")
        self.assertEqual(res["stage"], "core_intake")
        self.assertEqual(res["category"], "joint_muscle")

        # Verify Dynamic Core questions are asked first
        core_slots_seen = []
        bot_texts = [res["next_question"]]
        turns = 0

        while not res["is_complete"] and turns < 15:
            turns += 1
            slot = res["next_slot"]
            if slot and (slot.startswith("ayurveda.agni") or slot.startswith("ayurveda.sleep") or slot.startswith("ayurveda.thermal")):
                core_slots_seen.append(slot)

            options = res.get("quick_replies")
            ans = options[0] if options else "Moderate"
            res = process_turn(sid, ans, slot)
            bot_texts.append(res["next_question"])

        # Checks
        self.assertTrue(res["is_complete"], "Ayurveda conversation should complete")
        self.assertGreaterEqual(len(set(core_slots_seen)), 3, "Must collect Dynamic Core (Agni, Sleep, Thermal)")
        self.assertGreaterEqual(res["mcq_questions_asked"], 4, "Must ask at least 4 MCQ questions")
        self.assertTrue(
            any(w in bot_texts[-1].lower() for w in ("booking", "appointment", "doctor")),
            "Bot must close by handing off to appointment booking section",
        )

    def test_opening_with_symptoms_before_language_mode(self):
        res = start_session()
        sid = res["session_id"]
        self.assertEqual(res["stage"], "language_select")

        res = process_turn(sid, "Doctor mere chest mein bahut tez jalan ho rahi hai khane ke baad", "language_select")
        # Bot should acknowledge and still ask for language
        self.assertEqual(res["stage"], "language_select")
        self.assertIn("English", res["quick_replies"])

        # Patient picks Hinglish
        res = process_turn(sid, "Hinglish", "language_select")
        self.assertEqual(res["stage"], "mode_select")
        self.assertIn("English Medicine (Allopathic) Mode", res["quick_replies"])

        # Patient picks Allopathic
        res = process_turn(sid, "English Medicine Mode", "mode_select")
        # Bot should have kept the chief complaint and advanced directly to branching!
        self.assertEqual(res["stage"], "branching")
        self.assertIn("gastric", res["category"])

    def test_hinglish_code_switching(self):
        res = start_session()
        sid = res["session_id"]
        res = process_turn(sid, "Hinglish", "language_select")
        res = process_turn(sid, "English Medicine (Allopathic) Mode", "mode_select")
        res = process_turn(sid, "Chest pain", "chief_complaint")

        # In Hinglish, bot should ask questions code-switching between Hindi & English
        q = res["next_question"]
        self.assertTrue(
            any(w in q.lower() for w in ("kab se", "dard", "kaisa", "ho raha", "shuru")),
            f"Question should contain natural Hinglish phrasing: {q}",
        )

    def test_free_text_fallback_on_mcq(self):
        res = start_session()
        sid = res["session_id"]
        res = process_turn(sid, "English", "language_select")
        res = process_turn(sid, "English Medicine Mode", "mode_select")
        res = process_turn(sid, "I have knee pain", "chief_complaint")

        # Onset MCQ presented
        slot = res["next_slot"]
        options = res["quick_replies"]
        self.assertTrue(len(options) > 0, "MCQ options should be presented")

        # Patient types free text instead of clicking option
        res = process_turn(sid, "It started about 5 days ago after playing football", slot)
        # Should successfully advance to next slot
        self.assertNotEqual(res["next_slot"], slot)


if __name__ == "__main__":
    unittest.main()
