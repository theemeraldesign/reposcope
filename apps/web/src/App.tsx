import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Bell, BookOpen, ChevronRight, CircleHelp, GitBranch, Github, LayoutDashboard, LockKeyhole, Plus, Search, Settings2, ShieldCheck, Sparkles, Star, Menu, X } from 'lucide-react';
import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type Repo = { id: string; full_name: string; description: string | null; visibility: 'public' | 'private'; stars_count?: number; forks_count?: number; updated_at: string };

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState('');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) { setRepos([]); return; }
    supabase.from('repositories').select('id,full_name,description,visibility,updated_at').order('updated_at', { ascending: false })
      .then(({ data }) => setRepos((data ?? []) as Repo[]));
  }, [session]);

  const filteredRepos = useMemo(() => repos.filter((repo) => repo.full_name.toLowerCase().includes(query.toLowerCase())), [repos, query]);

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setAuthError('');
    const result = authMode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (result.error) setAuthError(result.error.message);
    else if (authMode === 'signup' && !result.data.session) setAuthError('Check your email to confirm your account, then sign in.');
  }

  if (!supabase) return <SetupScreen />;
  if (loading) return <div className="loading-screen"><span className="brand-mark">R</span><p>Preparing your workspace…</p></div>;
  if (!session) return <AuthScreen email={email} password={password} setEmail={setEmail} setPassword={setPassword} mode={authMode} setMode={setAuthMode} error={authError} onSubmit={authenticate} />;

  const initials = (session.user.email ?? 'U').slice(0, 1).toUpperCase();
  return <div className="app-shell">
    <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark">R</span><span>reposcope</span><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>
        <a className="nav-item active"><LayoutDashboard size={17}/> Overview</a>
        <a className="nav-item"><GitBranch size={17}/> Repositories <span className="nav-count">{repos.length}</span></a>
        <a className="nav-item"><Activity size={17}/> Activity</a>
        <a className="nav-item"><BookOpen size={17}/> Reports</a>
      </nav>
      <div className="sidebar-bottom">
        <a className="nav-item"><Settings2 size={17}/> Settings</a>
        <a className="nav-item"><CircleHelp size={17}/> Help centre</a>
        <div className="profile-chip"><span className="avatar">{initials}</span><span className="profile-email">{session.user.email}</span><button className="icon-button" title="Sign out" onClick={() => supabase.auth.signOut()}><ArrowUpRight size={16}/></button></div>
      </div>
    </aside>
    {mobileOpen && <button className="scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={19}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> Overview</div><div className="top-actions"><span className="status-dot"/> All systems operational <button className="icon-button"><Bell size={18}/></button></div></header>
      <div className="content">
        <section className="welcome-row"><div><div className="eyebrow">REPOSITORY INTELLIGENCE</div><h1>Your codebase, in focus.</h1><p className="subheading">A clear picture of what is happening across your repositories.</p></div><button className="primary-button" onClick={() => window.open('https://github.com/apps/reposcope', '_blank')}><Plus size={17}/> Connect GitHub</button></section>
        <section className="metric-grid">
          <Metric icon={<GitBranch size={18}/>} label="Repositories" value={String(repos.length)} note="Connected to your workspace"/>
          <Metric icon={<Activity size={18}/>} label="Analyses completed" value="—" note="No analysis runs yet"/>
          <Metric icon={<Star size={18}/>} label="Stars tracked" value="—" note="Waiting for repository data"/>
          <Metric icon={<ShieldCheck size={18}/>} label="Health overview" value="Pending" note="Your first analysis is next"/>
        </section>
        <section className="panel repo-panel"><div className="panel-heading"><div><h2>Your repositories</h2><p>Monitor public and private projects in one place.</p></div><div className="repo-tools"><div className="search-field"><Search size={16}/><input placeholder="Find a repository" value={query} onChange={(e) => setQuery(e.target.value)}/></div><button className="secondary-button" onClick={() => window.open('https://github.com/apps/reposcope', '_blank')}><Plus size={15}/> Add repository</button></div></div>
          {filteredRepos.length ? <div className="repo-list">{filteredRepos.map((repo) => <article className="repo-row" key={repo.id}><div className="repo-icon"><Github size={18}/></div><div className="repo-info"><strong>{repo.full_name}</strong><p>{repo.description || 'No description provided.'}</p></div><span className={repo.visibility === 'private' ? 'visibility private' : 'visibility'}>{repo.visibility === 'private' ? <LockKeyhole size={12}/> : <Github size={12}/>} {repo.visibility}</span><span className="repo-date">{new Date(repo.updated_at).toLocaleDateString()}</span><ChevronRight size={17} className="muted-icon"/></article>)}</div> : <div className="empty-state"><div className="empty-icon"><GitBranch size={22}/></div><h3>{query ? 'No matching repositories' : 'Your workspace is ready'}</h3><p>{query ? 'Try a different repository name.' : 'Connect GitHub to bring your repositories into RepoScope. Your first health report will appear here.'}</p>{!query && <button className="primary-button" onClick={() => window.open('https://github.com/apps/reposcope', '_blank')}><Github size={16}/> Connect your GitHub account</button>}</div>}
        </section>
        <div className="footer-note"><Sparkles size={14}/> Insights are based on repository evidence, with data freshness shown in every report.</div>
      </div>
    </main>
  </div>;
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <div className="metric-card"><div className="metric-top"><span className="metric-icon">{icon}</span><span>{label}</span></div><strong>{value}</strong><p>{note}</p></div>;
}
function SetupScreen() {
  return <div className="auth-page"><div className="auth-card"><span className="brand-mark">R</span><h1>Configure RepoScope</h1><p>Add the Supabase project URL and publishable key to the web app environment before starting the frontend.</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></div></div>;
}
function AuthScreen(props: { email: string; password: string; setEmail: (v: string) => void; setPassword: (v: string) => void; mode: 'signin' | 'signup'; setMode: (v: 'signin' | 'signup') => void; error: string; onSubmit: (e: React.FormEvent) => void }) {
  return <div className="auth-page"><div className="auth-card"><div className="brand auth-brand"><span className="brand-mark">R</span><span>reposcope</span></div><div className="eyebrow">YOUR ENGINEERING WORKSPACE</div><h1>{props.mode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h1><p>Sign in to understand the health and momentum of your repositories.</p><form onSubmit={props.onSubmit}><label>Email address<input type="email" required autoComplete="email" value={props.email} onChange={(e) => props.setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" minLength={8} required autoComplete={props.mode === 'signin' ? 'current-password' : 'new-password'} value={props.password} onChange={(e) => props.setPassword(e.target.value)} placeholder="At least 8 characters"/></label>{props.error && <div className="auth-error">{props.error}</div>}<button className="primary-button full-button" type="submit">{props.mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowUpRight size={16}/></button></form><div className="auth-switch">{props.mode === 'signin' ? 'New to RepoScope?' : 'Already have an account?'} <button onClick={() => props.setMode(props.mode === 'signin' ? 'signup' : 'signin')}>{props.mode === 'signin' ? 'Create an account' : 'Sign in'}</button></div><div className="secure-note"><LockKeyhole size={13}/> Your repositories stay private by default.</div></div></div>;
}

export default App;
