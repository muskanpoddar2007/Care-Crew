import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowRight, Bell, CalendarDays, ChevronLeft, ClipboardList, Clock3, FileText,
  HeartHandshake, Home, LogOut, Menu, MessageCircle, Moon, Plus,
  RotateCcw, Send, ShieldCheck, Stethoscope, Sun, UserRound, UsersRound, X, AlertTriangle,
  Activity, BookOpen, LockKeyhole, MapPin,
} from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import logoPath from '@assets/care-crew-logo.png';
import {
  api, ApiError, CaseSheet, clearSession, Evidence, getStoredSession, saveSession, SessionUser, User,
} from './api';

const queryClient = new QueryClient();
const departments = ['General Medicine', 'Cardiology', 'Dermatology', 'Pediatrics', 'Neurology', 'Orthopedics', 'ENT'];

function useSessionManager() {
  const [session, setSession] = useState<SessionUser | null>(() => getStoredSession());
  const [checking, setChecking] = useState(Boolean(getStoredSession()));
  useEffect(() => {
    const saved = getStoredSession();
    if (!saved) { setChecking(false); return; }
    api.auth.me(saved.token).then((user) => {
      const next = { ...saved, user };
      saveSession(next); setSession(next);
    }).catch(() => { clearSession(); setSession(null); }).finally(() => setChecking(false));
  }, []);
  const login = (data: { access_token: string; user: User }) => {
    const next = { token: data.access_token, user: data.user };
    saveSession(next); setSession(next); return next;
  };
  const logout = () => { clearSession(); setSession(null); };
  return { session, checking, login, logout };
}

function App() {
  const manager = useSessionManager();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <SessionContext.Provider value={manager}>
            <RoutedErrorBoundary>
              {manager.checking ? <PageLoader /> : <Router />}
            </RoutedErrorBoundary>
          </SessionContext.Provider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const SessionContext = {
  _currentValue: null as ReturnType<typeof useSessionManager> | null,
  Provider: ({ value, children }: { value: ReturnType<typeof useSessionManager>; children: ReactNode }) => {
    SessionContext._currentValue = value;
    return <>{children}</>;
  },
};
function useSession() { return SessionContext._currentValue!; }
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function PageLoader() {
  return <div className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--background))]"><div className="w-full max-w-sm p-8 space-y-3"><div className="h-12 w-12 rounded-2xl skeleton" /><div className="h-5 w-44 rounded skeleton" /><div className="h-3 w-64 rounded skeleton" /></div></div>;
}
function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2.5" data-testid="brand-care-crew"><img src={logoPath} alt="Care Crew" className={compact ? 'h-9 w-9 object-contain' : 'h-11 w-11 object-contain'} /><span className="font-bold tracking-tight text-[hsl(var(--secondary))] dark:text-[hsl(var(--foreground))]">{compact ? 'CareCrew' : 'Care'}{!compact && <span className="text-[hsl(var(--primary))]">Crew</span>}</span></div>;
}
function Button({ children, className = '', variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'soft' }) {
  return <button className={`cc-btn cc-btn-${variant} ${className}`} {...props}>{children}</button>;
}
function SectionTitle({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return <div className="mb-7"><div className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow}</div><h1 className="serif mt-2 text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>{detail && <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{detail}</p>}</div>;
}
function ErrorMessage({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="cc-card border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.05)] p-5" data-testid="status-error"><div className="flex gap-3"><AlertTriangle className="mt-0.5 text-[hsl(var(--destructive))]" size={18} /><div><p className="font-semibold">We couldn’t load that just now</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{message}</p>{retry && <Button variant="ghost" className="mt-3 px-0 text-[hsl(var(--destructive))]" onClick={retry} data-testid="button-retry"><RotateCcw size={15} /> Try again</Button>}</div></div></div>;
}
function EmptyState({ icon: Icon, title, detail, action }: { icon: typeof FileText; title: string; detail: string; action?: ReactNode }) {
  return <div className="cc-card flex flex-col items-center justify-center px-6 py-16 text-center" data-testid="state-empty"><div className="mb-4 rounded-2xl bg-[hsl(var(--primary)/.1)] p-4 text-[hsl(var(--primary))]"><Icon size={24} /></div><h3 className="font-bold">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function Router() {
  return <Switch>
    <Route path="/" component={HomePage} />
    <Route path="/role-select" component={RoleSelectPage} />
    <Route path="/auth/patient" component={() => <AuthPage role="patient" />} />
    <Route path="/auth/doctor" component={() => <AuthPage role="doctor" />} />
    <Route path="/symptom-check" component={SymptomCheckPage} />
    <Route path="/dashboard" component={() => <Protected><DashboardPage /></Protected>} />
    <Route path="/reports" component={() => <Protected role="patient"><ReportsPage /></Protected>} />
    <Route path="/reports/:sessionId" component={() => <Protected role="patient"><ReportDetailPage /></Protected>} />
    <Route path="/appointments" component={() => <Protected role="patient"><AppointmentsPage /></Protected>} />
    <Route path="/doctor-appointments" component={() => <Protected role="doctor"><DoctorAppointmentsPage /></Protected>} />
    <Route path="/profile" component={() => <Protected><ProfilePage /></Protected>} />
    <Route component={NotFoundPage} />
  </Switch>;
}
function Protected({ children, role }: { children: ReactNode; role?: 'patient' | 'doctor' }) {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  useEffect(() => { if (!session) setLocation('/role-select'); else if (role && session.user.role !== role) setLocation('/dashboard'); }, [session, role, setLocation]);
  if (!session || (role && session.user.role !== role)) return <PageLoader />;
  return <Shell>{children}</Shell>;
}

function Shell({ children }: { children: ReactNode }) {
  const { session, logout } = useSession();
  const [drawer, setDrawer] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('carecrew-theme') === 'dark');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('carecrew-theme', dark ? 'dark' : 'light'); }, [dark]);
  if (!session) return null;
  const doctor = session.user.role === 'doctor';
  const nav = doctor ? [
    { href: '/dashboard', label: 'Overview', icon: Home },
    { href: '/doctor-appointments', label: 'Appointments', icon: CalendarDays },
    { href: '/symptom-check', label: 'New case', icon: ClipboardList },
    { href: '/profile', label: 'My profile', icon: UserRound },
  ] : [
    { href: '/dashboard', label: 'Overview', icon: Home },
    { href: '/symptom-check', label: 'Symptom check', icon: ClipboardList },
    { href: '/reports', label: 'My reports', icon: FileText },
    { href: '/appointments', label: 'Appointments', icon: CalendarDays },
    { href: '/profile', label: 'My profile', icon: UserRound },
  ];
  const initials = session.user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  return <div className="cc-grain min-h-[100dvh] md:flex">
    {drawer && <button className="fixed inset-0 z-30 bg-[hsl(213_50%_10%/.35)] md:hidden" onClick={() => setDrawer(false)} aria-label="Close menu" data-testid="button-close-drawer" />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-6 transition-transform md:static md:translate-x-0 ${drawer ? 'translate-x-0' : '-translate-x-full'}`}>
      <Link href="/dashboard" className="mb-12 block" onClick={() => setDrawer(false)} data-testid="link-sidebar-logo"><Logo /></Link>
      <div className="mb-3 px-3 mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))]">Workspace</div>
      <nav className="space-y-1">{nav.map(({ href, label, icon: Icon }) => <Link href={href} key={href} onClick={() => setDrawer(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"><Icon size={18} strokeWidth={1.8} />{label}</Link>)}</nav>
      <div className="mt-auto space-y-1">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" onClick={() => setDark(!dark)} data-testid="button-theme-toggle">{dark ? <Sun size={18} /> : <Moon size={18} />}{dark ? 'Light mode' : 'Quiet dark mode'}</button>
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" onClick={logout} data-testid="button-logout"><LogOut size={18} />Sign out</button>
        <div className="mt-4 flex items-center gap-3 border-t border-[hsl(var(--border))] pt-4"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--secondary-foreground))]" data-testid="avatar-user">{initials}</div><div className="min-w-0"><p className="truncate text-sm font-bold" data-testid="text-sidebar-username">{session.user.name}</p><p className="text-xs capitalize text-[hsl(var(--muted-foreground))]">{session.user.role}</p></div></div>
      </div>
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[hsl(var(--border)/.75)] bg-[hsl(var(--background)/.88)] px-5 backdrop-blur-md md:px-10">
        <button className="mobile-only cc-btn cc-btn-ghost -ml-3 p-2" onClick={() => setDrawer(true)} data-testid="button-open-drawer"><Menu size={21} /></button>
        <div className="desktop-only text-xs text-[hsl(var(--muted-foreground))]"><span className="font-semibold text-[hsl(var(--foreground))]">Care Crew</span><span className="mx-2">/</span>{doctor ? 'Clinical workspace' : 'Your care space'}</div>
        <div className="ml-auto flex items-center gap-2"><Button variant="ghost" className="h-9 w-9 p-0" data-testid="button-notifications" aria-label="Notifications"><Bell size={17} /></Button><Link href="/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary)/.13)] text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-header-profile">{initials}</Link></div>
      </header>
      <div className="mx-auto max-w-[1240px] px-5 py-8 md:px-10 md:py-12">{children}</div>
    </main>
    <BotAssistant open={botOpen} onToggle={() => setBotOpen(!botOpen)} />
  </div>;
}

function BotAssistant({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { session } = useSession();
  const [message, setMessage] = useState('');
  const [lang, setLang] = useState<'en' | 'hi' | 'hinglish'>('en');
  const [reply, setReply] = useState('I can help you find your way around Care Crew.');
  const [busy, setBusy] = useState(false);
  async function ask(e: FormEvent) {
    e.preventDefault(); if (!message.trim()) return; setBusy(true);
    try { const result = await api.bot.query({ message, lang }, session?.token); setReply(result.reply); setMessage(''); }
    catch (error) { setReply(error instanceof ApiError ? error.message : 'I could not reach the care guide.'); }
    finally { setBusy(false); }
  }
  return <div className="fixed bottom-5 right-5 z-40">
    {open && <div className="mb-3 w-[min(350px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl"><div className="flex items-center justify-between bg-[hsl(var(--secondary))] p-4 text-[hsl(var(--secondary-foreground))]"><div className="flex items-center gap-2"><MessageCircle size={18} /><div><p className="text-sm font-bold">Care guide</p><p className="text-[10px] opacity-70">Navigation, not diagnosis</p></div></div><button onClick={onToggle} data-testid="button-close-bot"><X size={17} /></button></div><div className="p-4"><p className="min-h-12 text-sm leading-6 text-[hsl(var(--muted-foreground))]" data-testid="text-bot-reply">{reply}</p><div className="mb-3 flex gap-1">{(['en', 'hi', 'hinglish'] as const).map((item) => <button key={item} onClick={() => setLang(item)} className={`rounded-full px-2 py-1 text-[10px] font-bold ${lang === item ? 'bg-[hsl(var(--primary)/.13)] text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid={`button-language-${item}`}>{item}</button>)}</div><form onSubmit={ask} className="flex gap-2"><input value={message} onChange={(e) => setMessage(e.target.value)} className="cc-input py-2 text-xs" placeholder="Ask where to go..." data-testid="input-bot-message" /><Button disabled={busy} className="h-10 w-10 shrink-0 p-0" aria-label="Send question" data-testid="button-send-bot"><Send size={15} /></Button></form></div></div>}
    <Button onClick={onToggle} className="h-12 w-12 rounded-full p-0 shadow-lg" aria-label="Open care guide" data-testid="button-open-bot">{open ? <X size={20} /> : <MessageCircle size={20} />}</Button>
  </div>;
}

function HomePage() {
  const { session } = useSession();
  if (session) return <Shell><DashboardPage /></Shell>;
  return <div className="cc-grain min-h-[100dvh] overflow-hidden"><header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 md:px-10"><Logo /><div className="flex items-center gap-2"><Link href="/role-select" className="cc-btn cc-btn-ghost hidden sm:inline-flex" data-testid="link-home-sign-in">Sign in</Link><Link href="/role-select" className="cc-btn cc-btn-primary" data-testid="link-home-start">Get started <ArrowRight size={16} /></Link></div></header>
    <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-16 pt-12 md:grid-cols-[1.08fr_.92fr] md:px-10 md:pb-24 md:pt-20"><div className="absolute -left-32 -top-20 h-72 w-72 rounded-full bg-[hsl(var(--primary)/.12)] blur-3xl" /><div className="relative fade-up"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--primary)/.22)] bg-[hsl(var(--primary)/.07)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]"><ShieldCheck size={14} /> A calmer way to be heard</div><h1 className="serif max-w-2xl text-5xl font-semibold leading-[.98] tracking-[-.04em] text-[hsl(var(--secondary))] dark:text-[hsl(var(--foreground))] md:text-7xl">Your story is the first step in care.</h1><p className="mt-7 max-w-xl text-base leading-7 text-[hsl(var(--muted-foreground))] md:text-lg">Care Crew guides you through a thoughtful symptom conversation, then turns what you share into a clear case sheet your doctor can trust.</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/symptom-check" className="cc-btn cc-btn-primary" data-testid="link-start-symptom-check">Start a symptom check <ArrowRight size={17} /></Link><Link href="/role-select" className="cc-btn cc-btn-soft" data-testid="link-choose-role">I’m a care professional</Link></div><div className="mt-9 flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]"><div className="flex -space-x-2"><span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--accent))] text-[10px] font-bold">A</span><span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--primary))] text-[10px] font-bold text-white">R</span><span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--secondary))] text-[10px] font-bold text-white">M</span></div><span>Built for the moments that are hard to explain.</span></div></div>
      <div className="relative fade-up-2"><div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[hsl(var(--primary)/.15)]" /><div className="cc-card relative overflow-hidden p-5 md:p-7"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-5"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Case conversation</p><p className="mt-1 font-bold">Let’s take this one step at a time.</p></div><div className="rounded-xl bg-[hsl(var(--primary)/.12)] p-2.5 text-[hsl(var(--primary))]"><HeartHandshake size={20} /></div></div><div className="space-y-4 py-6"><div className="flex gap-3"><div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-[hsl(var(--secondary))]" /><div className="rounded-2xl rounded-tl-sm bg-[hsl(var(--muted))] px-4 py-3 text-sm leading-6">What brought you in today? There’s no need to find the perfect words.</div></div><div className="ml-10 rounded-2xl rounded-tr-sm bg-[hsl(var(--primary))] px-4 py-3 text-sm leading-6 text-[hsl(var(--primary-foreground))]">I’ve had a tight feeling in my chest since yesterday.</div><div className="flex gap-3"><div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-[hsl(var(--secondary))]" /><div className="rounded-2xl rounded-tl-sm bg-[hsl(var(--muted))] px-4 py-3 text-sm leading-6">Thank you for telling me. I’ll ask a few gentle follow-up questions.</div></div></div><div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-3 text-xs text-[hsl(var(--muted-foreground))]"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /> Your answers stay focused on your care conversation.</div></div></div></section>
    <section className="mx-auto max-w-7xl border-t border-[hsl(var(--border))] px-5 py-16 md:px-10 md:py-20"><div className="grid gap-10 md:grid-cols-3"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">01 / Speak freely</p><h2 className="serif mt-4 text-2xl">A space without rush.</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Answer in your own words. Care Crew listens for the details that help a clinician understand the full picture.</p></div><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">02 / See the shape</p><h2 className="serif mt-4 text-2xl">A case sheet, not a guess.</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Every summary keeps the original evidence close, so your doctor can see what you said and what needs attention.</p></div><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">03 / Take the next step</p><h2 className="serif mt-4 text-2xl">Clarity you can carry.</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Book a department, revisit your reports, or simply leave with a clearer sense of what to share.</p></div></div></section>
    <footer className="mx-auto flex max-w-7xl flex-col gap-4 border-t border-[hsl(var(--border))] px-5 py-8 text-xs text-[hsl(var(--muted-foreground))] md:flex-row md:items-center md:justify-between md:px-10"><span>Care Crew · A clinical history-taking workspace</span><span className="flex items-center gap-2"><LockKeyhole size={13} /> Your care conversation is yours.</span></footer>
  </div>;
}

function RoleSelectPage() {
  return <div className="cc-grain min-h-[100dvh] px-5 py-7 md:px-10"><header className="mx-auto max-w-6xl"><Link href="/" data-testid="link-role-logo"><Logo /></Link></header><main className="mx-auto flex max-w-5xl flex-col items-center py-16 text-center md:py-24"><div className="fade-up"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"><UsersRound size={26} /></div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Welcome to Care Crew</p><h1 className="serif mt-3 text-4xl font-semibold md:text-6xl">Who are you here as?</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[hsl(var(--muted-foreground))]">Choose your workspace. You can also start a symptom check without an account.</p></div><div className="mt-12 grid w-full gap-4 md:grid-cols-2"><Link href="/auth/patient" className="cc-card group p-7 text-left transition-transform hover:-translate-y-1" data-testid="link-role-patient"><div className="mb-12 flex items-start justify-between"><div className="rounded-xl bg-[hsl(var(--accent)/.2)] p-3 text-[hsl(var(--secondary))]"><HeartHandshake size={24} /></div><ArrowRight className="text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-1" /></div><h2 className="serif text-2xl">I’m seeking care</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Share symptoms, keep your reports, and request an appointment.</p></Link><Link href="/auth/doctor" className="cc-card group p-7 text-left transition-transform hover:-translate-y-1" data-testid="link-role-doctor"><div className="mb-12 flex items-start justify-between"><div className="rounded-xl bg-[hsl(var(--primary)/.13)] p-3 text-[hsl(var(--primary))]"><Stethoscope size={24} /></div><ArrowRight className="text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-1" /></div><h2 className="serif text-2xl">I’m a doctor</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Review concise, evidence-linked histories and your department appointments.</p></Link></div><Link href="/symptom-check" className="mt-8 text-sm font-bold text-[hsl(var(--primary))] hover:underline" data-testid="link-anonymous-check">Continue without an account <ArrowRight className="ml-1 inline" size={15} /></Link></main></div>;
}

function AuthPage({ role }: { role: 'patient' | 'doctor' }) {
  const { session, login } = useSession();
  const [, setLocation] = useLocation();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', department: departments[0], specialty: '' });
  useEffect(() => { if (session) setLocation('/dashboard'); }, [session, setLocation]);
  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const result = register ? await api.auth.register({ name: form.name, email: form.email, password: form.password, role, phone: form.phone || null, ...(role === 'doctor' ? { department: form.department, specialty: form.specialty } : {}) }) : await api.auth.login({ email: form.email, password: form.password });
      login(result); setLocation('/dashboard');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Please check your details and try again.'); } finally { setBusy(false); }
  }
  const doctor = role === 'doctor';
  return <div className="cc-grain min-h-[100dvh] md:grid md:grid-cols-[.8fr_1.2fr]"><div className="hidden flex-col justify-between bg-[hsl(var(--secondary))] p-10 text-[hsl(var(--secondary-foreground))] md:flex"><Link href="/" data-testid="link-auth-logo"><Logo /></Link><div><p className="mono text-[10px] uppercase tracking-[.22em] text-[hsl(var(--primary))]">A good history begins with listening</p><h2 className="serif mt-5 max-w-md text-5xl leading-[1.05]">The details matter. So does how you share them.</h2><p className="mt-6 max-w-sm text-sm leading-6 opacity-70">A focused space for patients and care professionals to meet the story behind a symptom.</p></div><p className="text-xs opacity-50">Care Crew · Clinical history, made human.</p></div><main className="flex min-h-[100dvh] flex-col px-5 py-7 md:px-14 md:py-10"><div className="md:hidden"><Link href="/" data-testid="link-auth-mobile-logo"><Logo /></Link></div><div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10"><Link href="/role-select" className="mb-8 flex items-center gap-1 text-xs font-bold text-[hsl(var(--muted-foreground))]" data-testid="link-back-role"><ChevronLeft size={15} /> Change workspace</Link><div className="mb-8"><div className="mb-4 inline-flex rounded-full bg-[hsl(var(--primary)/.1)] px-3 py-1 text-xs font-bold capitalize text-[hsl(var(--primary))]">{doctor ? 'Doctor workspace' : 'Patient workspace'}</div><h1 className="serif text-4xl font-semibold">{register ? 'Create your account' : 'Welcome back'}</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{register ? 'A few details, then we’ll make room for your story.' : 'Pick up where your care conversation left off.'}</p></div>{error && <div className="mb-5"><ErrorMessage message={error} /></div>}<form className="space-y-4" onSubmit={submit}>{register && <label className="block text-sm font-semibold">Full name<input className="cc-input mt-2" value={form.name} onChange={update('name')} required placeholder="Your name" data-testid="input-auth-name" /></label>}<label className="block text-sm font-semibold">Email<input className="cc-input mt-2" type="email" value={form.email} onChange={update('email')} required placeholder="you@example.com" data-testid="input-auth-email" /></label><label className="block text-sm font-semibold">Password<input className="cc-input mt-2" type="password" minLength={6} value={form.password} onChange={update('password')} required placeholder="At least 6 characters" data-testid="input-auth-password" /></label>{register && <label className="block text-sm font-semibold">Phone <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span><input className="cc-input mt-2" value={form.phone} onChange={update('phone')} placeholder="+91 ..." data-testid="input-auth-phone" /></label>}{register && doctor && <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Department<select className="cc-input mt-2" value={form.department} onChange={update('department')} data-testid="select-auth-department">{departments.map((d) => <option key={d}>{d}</option>)}</select></label><label className="block text-sm font-semibold">Specialty<input className="cc-input mt-2" value={form.specialty} onChange={update('specialty')} required placeholder="e.g. Consultant" data-testid="input-auth-specialty" /></label></div>}<Button type="submit" disabled={busy} className="mt-3 w-full" data-testid="button-auth-submit">{busy ? 'Creating a safe space...' : register ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></Button></form><div className="mt-7 text-center text-sm text-[hsl(var(--muted-foreground))]">{register ? 'Already have an account?' : 'New to Care Crew?'} <button className="font-bold text-[hsl(var(--primary))]" onClick={() => { setRegister(!register); setError(''); }} data-testid="button-toggle-auth-mode">{register ? 'Sign in' : 'Create one'}</button></div><Link href="/symptom-check" className="mt-5 text-center text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]" data-testid="link-auth-anonymous">Start a symptom check without signing in</Link></div></main></div>;
}

function DashboardPage() {
  const { session } = useSession();
  const doctor = session?.user.role === 'doctor';
  const name = session?.user.name.split(' ')[0] || 'there';
  return <div className="fade-up"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{doctor ? 'Clinical workspace' : 'Your care space'}</p><h1 className="serif mt-2 text-4xl font-semibold md:text-5xl">Good to see you, {name}.</h1><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{doctor ? 'A clear view of the cases and appointments waiting for you.' : 'Let’s keep the next step simple.'}</p></div><div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" /> Session protected</div></div><div className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_.65fr]"><div className="relative overflow-hidden rounded-2xl bg-[hsl(var(--secondary))] p-7 text-[hsl(var(--secondary-foreground))] md:p-9"><div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border-[28px] border-[hsl(var(--primary)/.2)]" /><div className="relative max-w-xl"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">{doctor ? <Stethoscope size={22} /> : <HeartHandshake size={22} />}</div><h2 className="serif text-3xl">{doctor ? 'Ready for the next case?' : 'Something on your mind?'}</h2><p className="mt-3 max-w-md text-sm leading-6 opacity-70">{doctor ? 'Review department appointments and open each patient’s context before they arrive.' : 'A guided conversation can help you collect the details worth sharing with your doctor.'}</p><Link href={doctor ? '/doctor-appointments' : '/symptom-check'} className="cc-btn cc-btn-primary mt-7" data-testid="link-dashboard-primary">{doctor ? 'View appointments' : 'Start symptom check'} <ArrowRight size={16} /></Link></div></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1"><Link href={doctor ? '/profile' : '/reports'} className="cc-card group flex items-center justify-between p-5" data-testid="link-dashboard-secondary"><div><p className="text-xs text-[hsl(var(--muted-foreground))]">{doctor ? 'Your practice' : 'Your history'}</p><h3 className="mt-1 font-bold">{doctor ? 'Profile & specialty' : 'Reports & summaries'}</h3></div><div className="rounded-xl bg-[hsl(var(--primary)/.1)] p-2.5 text-[hsl(var(--primary))] group-hover:translate-x-1"><ArrowRight size={17} /></div></Link><Link href={doctor ? '/symptom-check' : '/appointments'} className="cc-card group flex items-center justify-between p-5" data-testid="link-dashboard-tertiary"><div><p className="text-xs text-[hsl(var(--muted-foreground))]">{doctor ? 'For context' : 'Plan your visit'}</p><h3 className="mt-1 font-bold">{doctor ? 'Start a demo case' : 'Book an appointment'}</h3></div><div className="rounded-xl bg-[hsl(var(--accent)/.2)] p-2.5 text-[hsl(var(--secondary))] group-hover:translate-x-1"><ArrowRight size={17} /></div></Link></div></div><div className="mt-7 grid gap-5 md:grid-cols-3"><Insight icon={ShieldCheck} label="Privacy first" text="You decide what to share." /><Insight icon={BookOpen} label="Evidence-linked" text="The words stay close to the summary." /><Insight icon={Clock3} label="At your pace" text="Pause and return when ready." /></div></div>;
}
function Insight({ icon: Icon, label, text }: { icon: typeof ShieldCheck; label: string; text: string }) { return <div className="flex gap-3 border-t border-[hsl(var(--border))] pt-4"><Icon size={17} className="mt-0.5 text-[hsl(var(--primary))]" /><div><p className="text-sm font-bold">{label}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{text}</p></div></div>; }

type TranscriptItem = { from: 'care' | 'you'; text: string };
function SymptomCheckPage() {
  const { session } = useSession();
  const [, setLocation] = useLocation();
  const [sessionId, setSessionId] = useState('');
  const [question, setQuestion] = useState('');
  const [slot, setSlot] = useState('');
  const [input, setInput] = useState('');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [sheet, setSheet] = useState<CaseSheet | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  useEffect(() => { if (started) return; setStarted(true); api.session.start(session?.token).then((res) => { setSessionId(res.session_id); setQuestion(res.next_question); setSlot(res.next_slot || 'chief_complaint'); setUrgent(Boolean(res.is_urgent)); setTranscript([{ from: 'care', text: res.next_question }]); }).catch((err) => setError(err instanceof ApiError ? err.message : 'We could not start the conversation.')).finally(() => setBusy(false)); }, [session, started]);
  async function send(e: FormEvent) {
    e.preventDefault(); if (!input.trim() || !sessionId || sending) return; const text = input.trim(); setInput(''); setTranscript((old) => [...old, { from: 'you', text }]); setSending(true);
    try { const res = await api.session.turn({ session_id: sessionId, patient_text: text, asked_slot: slot }, session?.token); setSheet(res.state); setUrgent(Boolean(res.is_urgent)); if (!res.is_complete) { setQuestion(res.next_question); setSlot(res.next_slot || ''); setTranscript((old) => [...old, { from: 'care', text: res.next_question }]); } else { setQuestion('Your case sheet is ready to review.'); const final = await api.session.final(sessionId, session?.token).catch(() => res.state); setSheet(final); setTranscript((old) => [...old, { from: 'care', text: 'Your case sheet is ready to review.' }]); } } catch (err) { setError(err instanceof ApiError ? err.message : 'Your answer could not be saved.'); } finally { setSending(false); }
  }
  const complete = Boolean(sheet?.is_complete || (sheet && question.includes('ready')));
  return <div className="fade-up"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Guided history</p><h1 className="serif mt-2 text-4xl font-semibold">Let’s take this one step at a time.</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">This is not a diagnosis. It’s a clearer starting point for care.</p></div><Link href={session ? '/dashboard' : '/'} className="cc-btn cc-btn-ghost self-start px-0 md:self-auto" data-testid="link-exit-symptom-check"><ChevronLeft size={16} /> Exit</Link></div>{urgent && <div className="mt-7 flex items-start gap-3 rounded-2xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] p-4" data-testid="banner-urgent"><AlertTriangle className="mt-0.5 text-[hsl(var(--destructive))]" size={20} /><div><p className="font-bold text-[hsl(var(--destructive))]">Please seek urgent medical care</p><p className="mt-1 text-sm leading-6 text-[hsl(var(--foreground))]">Some of what you shared may need immediate attention. If you feel unsafe or symptoms are severe, contact local emergency services now.</p></div></div>}{error && <div className="mt-6"><ErrorMessage message={error} retry={() => location.reload()} /></div>}<div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"><div className="cc-card flex min-h-[600px] flex-col overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><HeartHandshake size={17} /></div><div><p className="text-sm font-bold">Care conversation</p><p className="text-[11px] text-[hsl(var(--muted-foreground))]">Private · guided · evidence-linked</p></div></div><span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{transcript.filter((item) => item.from === 'you').length} answers</span></div><div className="flex-1 space-y-5 overflow-y-auto p-5 md:p-7">{busy ? <div className="space-y-4"><div className="h-12 w-3/4 rounded-2xl skeleton" /><div className="ml-auto h-12 w-1/2 rounded-2xl skeleton" /><div className="h-12 w-2/3 rounded-2xl skeleton" /></div> : transcript.map((item, index) => <div key={`${index}-${item.from}`} className={`flex gap-3 ${item.from === 'you' ? 'justify-end' : ''}`} data-testid={`message-${item.from}-${index}`}>{item.from === 'care' && <div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-[hsl(var(--secondary))]" />}<div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.from === 'you' ? 'rounded-tr-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'rounded-tl-sm bg-[hsl(var(--muted))]'}`}>{item.text}</div></div>)}</div><div className="border-t border-[hsl(var(--border))] p-4 md:p-5"><form onSubmit={send} className="flex items-end gap-2"><textarea className="cc-input min-h-[52px] resize-none" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy || sending || complete} placeholder={complete ? 'Conversation complete' : 'Share what feels important...'} rows={2} data-testid="input-symptom-answer" /><Button type="submit" disabled={busy || sending || complete || !input.trim()} className="h-[52px] w-[52px] shrink-0 p-0" aria-label="Send answer" data-testid="button-send-answer">{sending ? <Activity className="animate-pulse" size={18} /> : <Send size={18} />}</Button></form><p className="mt-2 px-1 text-[10px] text-[hsl(var(--muted-foreground))]">You can write naturally. There are no wrong words.</p></div></div><CaseSheetPanel sheet={sheet} complete={complete} sessionId={sessionId} onOpenReport={() => session ? setLocation(`/reports/${sessionId}`) : undefined} /></div></div>;
}

function CaseSheetPanel({ sheet, complete, sessionId, onOpenReport }: { sheet: CaseSheet | null; complete: boolean; sessionId: string; onOpenReport: () => void }) {
  const [audience, setAudience] = useState<'patient' | 'doctor'>('patient');
  const [summary, setSummary] = useState('');
  const { session } = useSession();
  useEffect(() => { if (complete && sessionId) api.session.summary(sessionId, audience, session?.token).then((res) => setSummary(res.summary)).catch(() => setSummary('Summary will be available after the case is saved.')); }, [complete, sessionId, audience, session]);
  const valueOf = (field?: Evidence | string) => typeof field === 'string' ? field : field?.value;
  return <aside className="cc-card h-fit overflow-hidden xl:sticky xl:top-24"><div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)] px-5 py-4"><div className="flex items-center justify-between"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Live case sheet</p><h2 className="mt-1 font-bold">What we’ve heard</h2></div><ClipboardList className="text-[hsl(var(--primary))]" size={19} /></div></div>{!sheet ? <div className="p-5"><div className="mb-5 h-4 w-28 rounded skeleton" /><div className="space-y-4"><div className="h-12 rounded-xl skeleton" /><div className="h-12 rounded-xl skeleton" /><div className="h-12 rounded-xl skeleton" /></div><p className="mt-6 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Your case sheet will take shape as you share more.</p></div> : <div className="p-5"><div className="space-y-4">{[['Chief complaint', valueOf(sheet.chief_complaint)], ['History of present illness', valueOf(sheet.hopi)], ['Allergies', valueOf(sheet.allergies)], ['Department', sheet.department], ['Possible concern', sheet.condition_key]].filter(([, value]) => value).map(([label, value]) => <div key={label as string}><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-1 text-sm leading-5" data-testid={`text-casesheet-${String(label).toLowerCase().replaceAll(' ', '-')}`}>{String(value)}</p></div>)}</div>{complete && <div className="mt-5 border-t border-[hsl(var(--border))] pt-5"><div className="mb-3 flex rounded-lg bg-[hsl(var(--muted))] p-1">{(['patient', 'doctor'] as const).map((item) => <button key={item} className={`flex-1 rounded-md py-1.5 text-xs font-bold capitalize ${audience === item ? 'bg-[hsl(var(--card))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} onClick={() => setAudience(item)} data-testid={`button-summary-${item}`}>{item} view</button>)}</div><p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]" data-testid="text-live-summary">{summary || 'Preparing summary...'}</p><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">{session && <Link href={`/reports/${sessionId}`} className="inline-flex text-xs font-bold text-[hsl(var(--primary))]" onClick={onOpenReport} data-testid="link-open-report">Open full report <ArrowRight size={14} className="ml-1" /></Link>}{session?.user.role === 'patient' && <Link href="/appointments" className="inline-flex text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-case-appointment">Plan an appointment <CalendarDays size={14} className="ml-1" /></Link>}{!session && <Link href="/role-select" className="inline-flex text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-case-create-account">Create an account to save it <ArrowRight size={14} className="ml-1" /></Link>}</div></div>}</div>}</aside>;
}

function ReportsPage() {
  const { session } = useSession();
  const [reports, setReports] = useState<CaseSheet[]>([]);
  const [busy, setBusy] = useState(true); const [error, setError] = useState('');
  const load = () => { if (!session) return; setBusy(true); api.session.reports(session.token).then(setReports).catch((err) => setError(err instanceof ApiError ? err.message : 'Reports are not available right now.')).finally(() => setBusy(false)); };
  useEffect(load, [session]);
  return <div className="fade-up"><SectionTitle eyebrow="Your history" title="Reports you can return to." detail="Each report keeps your words close to a structured case sheet. It is a record to share with a clinician, not a diagnosis." />{error ? <ErrorMessage message={error} retry={load} /> : busy ? <ListSkeleton /> : reports.length === 0 ? <EmptyState icon={FileText} title="Your first report starts here." detail="A guided symptom check creates a clear case sheet you can revisit and share." action={<Link href="/symptom-check" className="cc-btn cc-btn-primary" data-testid="link-empty-start-check">Start symptom check <ArrowRight size={16} /></Link>} /> : <div className="space-y-3">{reports.map((report, index) => <ReportCard report={report} key={report.session_id || index} />)}</div>}</div>;
}
function ReportCard({ report }: { report: CaseSheet }) {
  const title = typeof report.chief_complaint === 'string' ? report.chief_complaint : report.chief_complaint?.value || 'Symptom conversation';
  return <Link href={`/reports/${report.session_id}`} className="cc-card group block p-5 transition-transform hover:-translate-y-0.5 md:p-6" data-testid={`card-report-${report.session_id}`}><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div className="flex gap-4"><div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] sm:flex"><FileText size={19} /></div><div><p className="text-xs text-[hsl(var(--muted-foreground))]">{report.completed_at ? new Date(report.completed_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Recently completed'}</p><h3 className="mt-1 font-bold">{title}</h3><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{report.department || 'Care team'} {report.condition_key ? `· ${report.condition_key}` : ''}</p></div></div><div className="flex items-center gap-3">{report.is_urgent && <span className="rounded-full bg-[hsl(var(--destructive)/.1)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--destructive))]">Urgent follow-up</span>}<ArrowRight size={17} className="text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-1" /></div></div></Link>;
}
function ListSkeleton() { return <div className="space-y-3">{[1, 2, 3].map((x) => <div key={x} className="cc-card h-24 skeleton" />)}</div>; }

function ReportDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>(); const { session } = useSession();
  const [report, setReport] = useState<CaseSheet | null>(null); const [audience, setAudience] = useState<'patient' | 'doctor'>('patient'); const [summary, setSummary] = useState(''); const [busy, setBusy] = useState(true); const [error, setError] = useState('');
  useEffect(() => { if (!sessionId || !session) return; Promise.all([api.session.final(sessionId, session.token), api.session.reportSummary(sessionId, audience, session.token)]).then(([sheet, sum]) => { setReport(sheet); setSummary(sum.summary); }).catch((err) => setError(err instanceof ApiError ? err.message : 'This report could not be opened.')).finally(() => setBusy(false)); }, [sessionId, session, audience]);
  return <div className="fade-up"><Link href="/reports" className="mb-7 inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--muted-foreground))]" data-testid="link-back-reports"><ChevronLeft size={15} /> All reports</Link>{busy ? <ListSkeleton /> : error ? <ErrorMessage message={error} /> : report && <><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Case sheet · {report.session_id}</p><h1 className="serif mt-2 max-w-3xl text-4xl font-semibold">{typeof report.chief_complaint === 'string' ? report.chief_complaint : report.chief_complaint?.value || 'Care conversation'}</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{report.completed_at ? new Date(report.completed_at).toLocaleString() : 'Completed recently'} {report.department ? `· ${report.department}` : ''}</p></div>{report.is_urgent && <div className="flex items-center gap-2 rounded-full bg-[hsl(var(--destructive)/.1)] px-3 py-2 text-xs font-bold text-[hsl(var(--destructive))]"><AlertTriangle size={15} /> Urgent follow-up</div>}</div><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]"><div className="cc-card p-6 md:p-8"><div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] pb-5 sm:flex-row sm:items-center"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Summary for</p><h2 className="serif mt-1 text-2xl capitalize">{audience === 'patient' ? 'you' : 'your doctor'}</h2></div><div className="flex rounded-lg bg-[hsl(var(--muted))] p-1">{(['patient', 'doctor'] as const).map((item) => <button key={item} onClick={() => setAudience(item)} className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize ${audience === item ? 'bg-[hsl(var(--card))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid={`button-report-summary-${item}`}>{item}</button>)}</div></div><p className="mt-6 whitespace-pre-line text-[15px] leading-8" data-testid="text-report-summary">{summary}</p><div className="mt-8 rounded-xl bg-[hsl(var(--muted)/.55)] p-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><ShieldCheck className="mb-2 text-[hsl(var(--primary))]" size={17} />This summary reflects what was shared in your conversation. A qualified clinician makes the medical assessment.</div></div><div className="space-y-4"><div className="cc-card p-5"><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Evidence in the record</p><EvidenceRow label="History of present illness" value={report.hopi} /><EvidenceRow label="Past history" value={report.past_history} /><EvidenceRow label="Allergies" value={report.allergies} /><EvidenceRow label="Personal history" value={report.personal_history} /></div><Link href="/appointments" className="cc-btn cc-btn-primary w-full" data-testid="link-report-appointment">Plan an appointment <CalendarDays size={16} /></Link></div></div></>}</div>;
}
function EvidenceRow({ label, value }: { label: string; value?: Evidence | string }) { const text = typeof value === 'string' ? value : value?.value; return <div className="border-b border-[hsl(var(--border))] py-3 last:border-0"><p className="text-xs font-bold">{label}</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{text || 'Not shared'}</p>{value && typeof value !== 'string' && value.evidence && <p className="mt-1 text-[10px] italic text-[hsl(var(--primary))]">Evidence: “{value.evidence}”</p>}</div>; }

function AppointmentsPage() {
  const { session } = useSession(); const [appointments, setAppointments] = useState<Awaited<ReturnType<typeof api.appointments.patientList>>>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [formOpen, setFormOpen] = useState(false); const [saving, setSaving] = useState(false); const [form, setForm] = useState({ department: departments[0], preferred_date: '', note: '', urgent: false });
  const load = () => { if (!session) return; setBusy(true); api.appointments.patientList(session.token).then(setAppointments).catch((err) => setError(err instanceof ApiError ? err.message : 'Appointments are not available.')).finally(() => setBusy(false)); };
  useEffect(load, [session]);
  async function book(e: FormEvent) { e.preventDefault(); if (!session) return; setSaving(true); try { const item = await api.appointments.book({ ...form, preferred_date: form.preferred_date || null, note: form.note || null }, session.token); setAppointments([item, ...appointments]); setFormOpen(false); setForm({ department: departments[0], preferred_date: '', note: '', urgent: false }); } catch (err) { setError(err instanceof ApiError ? err.message : 'We could not book that request.'); } finally { setSaving(false); } }
  return <div className="fade-up"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionTitle eyebrow="Care planning" title="Appointments, without the phone tag." detail="Request the department that feels right. A care team can follow up with the next available time." /><Button onClick={() => setFormOpen(!formOpen)} className="self-start md:mb-8" data-testid="button-open-booking">{formOpen ? <X size={16} /> : <Plus size={16} />}{formOpen ? 'Close' : 'Request appointment'}</Button></div>{formOpen && <form onSubmit={book} className="cc-card mb-6 grid gap-4 p-5 md:grid-cols-2 md:p-6"><div className="md:col-span-2"><p className="font-bold">Tell us what would help</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">This is a request, not a confirmed booking.</p></div><label className="text-sm font-semibold">Department<select className="cc-input mt-2" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} data-testid="select-appointment-department">{departments.map((d) => <option key={d}>{d}</option>)}</select></label><label className="text-sm font-semibold">Preferred date<input className="cc-input mt-2" type="date" value={form.preferred_date} onChange={(e) => setForm({ ...form, preferred_date: e.target.value })} data-testid="input-appointment-date" /></label><label className="text-sm font-semibold md:col-span-2">Note <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span><textarea className="cc-input mt-2 min-h-24 resize-y" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Anything your care team should know?" data-testid="input-appointment-note" /></label><label className="flex items-center gap-3 text-sm font-semibold md:col-span-2"><input type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid="input-appointment-urgent" /> I need an urgent callback</label><Button type="submit" disabled={saving} className="md:col-span-2" data-testid="button-submit-appointment">{saving ? 'Sending request...' : 'Send request'} <ArrowRight size={16} /></Button></form>}{error && <div className="mb-5"><ErrorMessage message={error} retry={load} /></div>}{busy ? <ListSkeleton /> : appointments.length === 0 ? <EmptyState icon={CalendarDays} title="No appointments yet." detail="When you’re ready, request a department and we’ll keep the next step in one place." action={<Button onClick={() => setFormOpen(true)} data-testid="button-empty-booking">Request an appointment <Plus size={16} /></Button>} /> : <div className="space-y-3">{appointments.map((item) => <div className="cc-card p-5" key={item.id} data-testid={`card-appointment-${item.id}`}><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="flex gap-3"><div className="rounded-xl bg-[hsl(var(--primary)/.1)] p-2.5 text-[hsl(var(--primary))]"><CalendarDays size={18} /></div><div><p className="font-bold">{item.department}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{item.preferred_date ? `Preferred ${new Date(item.preferred_date).toLocaleDateString()}` : 'Date to be confirmed'} {item.note ? `· ${item.note}` : ''}</p></div></div><span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${item.urgent ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{item.urgent ? 'Urgent request' : item.status || 'Requested'}</span></div></div>)}</div>}</div>;
}

function DoctorAppointmentsPage() {
  const { session } = useSession(); const [items, setItems] = useState<Awaited<ReturnType<typeof api.appointments.doctorList>>>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState('');
  const load = () => { if (!session) return; setBusy(true); api.appointments.doctorList(session.token).then(setItems).catch((err) => setError(err instanceof ApiError ? err.message : 'Appointments are not available.')).finally(() => setBusy(false)); };
  useEffect(load, [session]);
  const scoped = useMemo(() => items.filter((item) => !session?.user.department || item.department === session.user.department), [items, session]);
  return <div className="fade-up"><SectionTitle eyebrow="Department queue" title="Appointments waiting for you." detail={`${session?.user.department || 'Your department'} · Review the request before the patient arrives.`} />{error ? <ErrorMessage message={error} retry={load} /> : busy ? <ListSkeleton /> : scoped.length === 0 ? <EmptyState icon={CalendarDays} title="The queue is clear." detail="New requests for your department will appear here when patients ask for care." /> : <div className="space-y-3">{scoped.map((item) => <div className="cc-card p-5 md:p-6" key={item.id} data-testid={`card-doctor-appointment-${item.id}`}><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div className="flex gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><UserRound size={19} /></div><div><div className="flex items-center gap-2"><h3 className="font-bold">Patient request</h3>{item.urgent && <span className="rounded-full bg-[hsl(var(--destructive)/.1)] px-2 py-1 text-[10px] font-bold text-[hsl(var(--destructive))]">Urgent</span>}</div><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{item.department} · {item.preferred_date ? new Date(item.preferred_date).toLocaleDateString() : 'Date to coordinate'}</p>{item.note && <p className="mt-3 max-w-xl text-sm leading-6">“{item.note}”</p>}</div></div><span className="mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{item.status || 'Requested'}</span></div></div>)}</div>}</div>;
}

function ProfilePage() {
  const { session, logout } = useSession(); if (!session) return null; const { user } = session; const initials = user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  return <div className="fade-up max-w-3xl"><SectionTitle eyebrow="Your details" title="A little context about you." detail="Keep your account details current so your care team has the right frame of reference." /><div className="cc-card overflow-hidden"><div className="bg-[hsl(var(--secondary))] px-6 py-8 text-[hsl(var(--secondary-foreground))] md:px-8"><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-xl font-bold" data-testid="avatar-profile">{initials}</div><div><h2 className="serif text-2xl">{user.name}</h2><p className="mt-1 text-sm capitalize opacity-70">{user.role} account</p></div></div></div><div className="grid gap-5 p-6 md:grid-cols-2 md:p-8"><ProfileField label="Email" value={user.email} /><ProfileField label="Phone" value={user.phone || 'Not added'} /><ProfileField label="Department" value={user.department || 'Not set'} /><ProfileField label="Specialty" value={user.specialty || 'Not set'} /></div><div className="border-t border-[hsl(var(--border))] px-6 py-5 md:px-8"><button onClick={logout} className="flex items-center gap-2 text-sm font-bold text-[hsl(var(--destructive))]" data-testid="button-profile-logout"><LogOut size={16} /> Sign out of Care Crew</button></div></div></div>;
}
function ProfileField({ label, value }: { label: string; value: string }) { return <div><p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-2 font-semibold" data-testid={`text-profile-${label.toLowerCase()}`}>{value}</p></div>; }
function NotFoundPage() {
  return <div className="cc-grain flex min-h-[100dvh] items-center justify-center px-5 text-center"><div className="max-w-md"><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"><MapPin size={27} /></div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">404 · page not found</p><h1 className="serif mt-3 text-5xl font-semibold">This path took a wrong turn.</h1><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">The care space you’re looking for isn’t here, but we can take you somewhere useful.</p><Link href="/" className="cc-btn cc-btn-primary mt-7" data-testid="link-404-home">Return home <ArrowRight size={16} /></Link></div></div>;
}

export default App;