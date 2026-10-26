import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import api, { messageOf } from './api.js';

const blank = { title: '', description: '', dueDate: '', priority: 'MEDIUM', category: 'General', estimatedDuration: 30 };
const filters = ['All', 'Today', 'Upcoming', 'Overdue', 'Completed'];
const dateLabel = (date, options = { month: 'short', day: 'numeric' }) => date ? new Date(date).toLocaleDateString(undefined, options) : 'No due date';

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => { api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => {}).finally(() => setChecking(false)); }, []);
  if (checking) return <div className="grid min-h-screen place-items-center text-sm text-muted">Loading TaskMate…</div>;
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" onAuth={setUser} />} />
    <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" onAuth={setUser} />} />
    <Route path="/" element={user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

function AuthPage({ mode, onAuth }) {
  const isRegister = mode === 'register';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const { data } = await api.post(`/auth/${mode}`, Object.fromEntries(form.entries()));
      onAuth(data.user); navigate('/');
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-white px-5 py-12">
    <div className="w-full max-w-[390px]">
      <Link to="/login" className="mb-12 inline-flex items-center gap-2.5 font-semibold tracking-tight text-ink"><BrandMark />TaskMate</Link>
      <p className="mb-3 text-sm font-medium text-accent">A little more focus, every day</p>
      <h1 className="text-3xl font-semibold tracking-tight">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">{isRegister ? 'Start organizing the work that matters.' : 'Sign in to pick up where you left off.'}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {isRegister && <Field label="Your name" name="name" placeholder="Alex Morgan" required maxLength="60" />}
        <Field label="Email address" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
        <Field label="Password" name="password" type="password" placeholder="At least 8 characters" required minLength="8" autoComplete={isRegister ? 'new-password' : 'current-password'} />
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="mt-2 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">{isRegister ? 'Already have an account?' : 'New to TaskMate?'} <Link className="font-semibold text-accent hover:underline" to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
      <p className="mt-14 text-center text-xs text-slate-400">A clearer day starts with one small step.</p>
    </div>
  </main>;
}

function Dashboard({ user, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [counters, setCounters] = useState({ total: 0, completed: 0, remaining: 0, today: 0, overdue: 0, progress: 0 });
  const [filter, setFilter] = useState('All');
  const [modalTask, setModalTask] = useState(undefined);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recommended, setRecommended] = useState(false);
  const [loadError, setLoadError] = useState('');

  const refresh = useCallback(async () => {
    const { data } = await api.get('/tasks'); setTasks(data.tasks); setCounters(data.counters); setLoadError('');
  }, []);
  useEffect(() => { refresh().catch((e) => { setLoadError(messageOf(e)); setToast(messageOf(e)); }).finally(() => setLoading(false)); }, [refresh]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);

  const visible = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return tasks.filter((task) => {
      const date = task.dueDate ? new Date(task.dueDate) : null;
      if (filter === 'Completed') return task.isCompleted;
      if (task.isCompleted) return false;
      if (filter === 'Today') return date && date >= now && date < new Date(now.getTime() + 86400000);
      if (filter === 'Upcoming') return date && date >= new Date(now.getTime() + 86400000);
      if (filter === 'Overdue') return date && date < now;
      return true;
    });
  }, [tasks, filter]);

  async function mutate(path, method, body) {
    setBusy(true);
    try { const { data } = await api({ url: path, method, data: body }); setTasks(data.tasks); setCounters(data.counters); setEstimate(null); setRecommended(false); setModalTask(undefined); }
    catch (e) { setToast(messageOf(e)); }
    finally { setBusy(false); }
  }
  async function toggle(task) { await mutate(`/tasks/${task.id}/complete`, 'patch', { isCompleted: !task.isCompleted }); }
  async function recommend() {
    try {
      const { data } = await api.get('/tasks/recommended-order');
      const rank = new Map(data.tasks.map((task, index) => [task.id, index]));
      const scores = new Map(data.tasks.map((task) => [task.id, task.priorityScore]));
      setTasks((current) => current.map((task) => ({ ...task, priorityScore: scores.get(task.id) })).sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999)));
      setRecommended(true);
    } catch (e) { setToast(messageOf(e)); }
  }
  async function getEstimate() {
    setEstimateLoading(true);
    try { const { data } = await api.post('/tasks/estimate', { taskIds: tasks.filter((task) => !task.isCompleted).map((task) => task.id) }); setEstimate(data); }
    catch (e) { setToast(messageOf(e)); }
    finally { setEstimateLoading(false); }
  }
  async function logout() { try { await api.post('/auth/logout'); } finally { onLogout(); } }

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return <div className="min-h-screen bg-canvas">
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-[238px] flex-col border-r border-line bg-white px-5 py-6 md:flex">
      <Link to="/" className="inline-flex items-center gap-2.5 px-2 font-semibold tracking-tight"><BrandMark />TaskMate</Link>
      <div className="mt-12 px-2 text-[11px] font-semibold uppercase tracking-[.12em] text-slate-400">Workspace</div>
      <nav className="mt-3 space-y-1" aria-label="Task filters">
        {filters.map((name) => <button key={name} onClick={() => setFilter(name)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${filter === name ? 'bg-indigo-50 font-semibold text-accent' : 'text-slate-600 hover:bg-slate-50'}`}><span>{name}</span>{name === 'Today' && counters.today > 0 && <span className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-500">{counters.today}</span>}</button>)}
      </nav>
      <div className="mt-auto border-t border-line pt-4">
        <div className="flex items-center gap-3 px-2"><div className="grid h-9 w-9 place-items-center rounded-full bg-indigo-50 text-sm font-semibold text-accent">{user.name.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-muted">{user.email}</p></div></div>
        <button onClick={logout} className="mt-4 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 hover:text-ink">Sign out</button>
      </div>
    </aside>
    <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-5 sm:px-7 md:ml-[238px] md:px-10 md:pt-9">
      <header className="flex items-center justify-between border-b border-line pb-4 md:hidden"><Link to="/" className="inline-flex items-center gap-2 font-semibold"><BrandMark />TaskMate</Link><button onClick={logout} className="text-sm text-muted">Sign out</button></header>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-7 md:pt-0"><div><p className="text-sm text-muted">{today}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user.name.split(' ')[0]}</h1><p className="mt-1 text-sm text-muted">A little progress adds up. Here's your day.</p></div><button onClick={() => setModalTask(null)} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><span className="text-lg leading-none">+</span> New task</button></div>
      <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Task overview">
        <Stat label="Open tasks" value={counters.remaining} hint="Ready when you are" symbol="◷" />
        <Stat label="Due today" value={counters.today} hint="Keep today in focus" symbol="▣" />
        <Stat label="Overdue" value={counters.overdue} hint={counters.overdue ? 'Worth a quick review' : 'You’re all caught up'} symbol="⌁" alert={counters.overdue > 0} />
        <Stat label="Completed" value={counters.completed} hint={`${counters.progress}% of all tasks`} symbol="✓" />
      </section>
      <section className="mt-5 rounded-xl border border-line bg-white p-5 sm:p-6" aria-label="Project progress"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Your progress</h2><p className="mt-1 text-xs text-muted">Every finished task moves you forward.</p></div><span className="text-sm font-semibold text-accent">{counters.progress}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${counters.progress}%` }} /></div></section>
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">{recommended ? 'Recommended order' : 'Your tasks'}</h2><p className="mt-1 text-sm text-muted">{visible.length} {visible.length === 1 ? 'task' : 'tasks'} {filter !== 'All' ? `in ${filter.toLowerCase()}` : 'in your list'}</p></div><div className="flex gap-2"><button onClick={getEstimate} disabled={estimateLoading} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-slate-300 disabled:opacity-60">{estimateLoading ? 'Estimating…' : 'Estimate time'}</button><button onClick={recommend} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-slate-300">✦ Recommended order</button></div></div>
        {estimateLoading && <p role="status" className="mt-4 rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted">Running 1,000 task-time simulations…</p>}
        {estimate && <div role="status" className="mt-4 grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950 sm:grid-cols-3"><p>Minimum<strong className="mt-1 block">{estimate.readable.minimum}</strong></p><p>Average<strong className="mt-1 block">{estimate.readable.average}</strong></p><p>Maximum<strong className="mt-1 block">{estimate.readable.maximum}</strong></p><p className="text-xs text-indigo-700 sm:col-span-3">{estimate.simulations.toLocaleString()} simulations · minutes: {estimate.minimumEstimatedTime}–{estimate.maximumEstimatedTime}</p></div>}
        <div className="mt-4 flex gap-1 overflow-x-auto rounded-lg border border-line bg-white p-1 md:hidden">{filters.map((name) => <button key={name} onClick={() => setFilter(name)} className={`shrink-0 rounded-md px-3 py-2 text-xs ${filter === name ? 'bg-indigo-50 font-semibold text-accent' : 'text-slate-500'}`}>{name}</button>)}</div>
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
          {loading ? <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading tasks">{[1, 2, 3].map((n) => <div key={n} className="h-[68px] animate-pulse rounded-lg bg-slate-50" />)}</div> : loadError ? <div role="alert" className="px-5 py-12 text-center text-sm text-rose-700">{loadError}<button onClick={() => { setLoading(true); refresh().catch((e) => setLoadError(messageOf(e))).finally(() => setLoading(false)); }} className="ml-2 font-semibold underline">Try again</button></div> : visible.length ? <ul className="divide-y divide-line">{visible.map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggle(task)} onEdit={() => setModalTask(task)} onDelete={() => { if (window.confirm(`Delete “${task.title}”?`)) mutate(`/tasks/${task.id}`, 'delete'); }} />)}</ul> : <div className="px-5 py-14 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-indigo-50 text-lg text-accent">✓</div><h3 className="mt-4 text-sm font-semibold">{filter === 'All' ? 'A fresh start' : `Nothing ${filter.toLowerCase()} right now`}</h3><p className="mt-1 text-sm text-muted">{filter === 'All' ? 'Add a task to make a little progress today.' : 'Your list is clear. Enjoy the breathing room.'}</p>{filter === 'All' && <button onClick={() => setModalTask(null)} className="mt-4 text-sm font-semibold text-accent hover:underline">Create your first task</button>}</div>}
        </div>
      </section>
    </main>
    {toast && <div role="status" className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">{toast}</div>}
    {modalTask !== undefined && <TaskModal task={modalTask} busy={busy} onClose={() => !busy && setModalTask(undefined)} onSave={(values) => mutate(modalTask?.id ? `/tasks/${modalTask.id}` : '/tasks', modalTask?.id ? 'put' : 'post', values)} />}
  </div>;
}

function TaskRow({ task, onToggle, onEdit, onDelete }) {
  return <li className="group flex items-start gap-3 px-4 py-4 sm:items-center sm:px-5"><button onClick={onToggle} aria-label={task.isCompleted ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition sm:mt-0 ${task.isCompleted ? 'border-accent bg-accent text-white' : 'border-slate-300 text-transparent hover:border-accent'}`}><span className="text-xs">✓</span></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className={`text-sm font-medium ${task.isCompleted ? 'text-slate-400 line-through' : 'text-ink'}`}>{task.title}</h3><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${task.priority === 'HIGH' ? 'bg-rose-50 text-rose-600' : task.priority === 'LOW' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{task.priority}</span>{task.priorityScore !== undefined && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-accent">Score {task.priorityScore}</span>}</div>{task.description && <p className="mt-1 truncate text-xs text-muted">{task.description}</p>}<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400"><span>{task.category}</span><span>{task.estimatedDuration} min</span><span className={task.isOverdue ? 'font-medium text-rose-600' : ''}>{dateLabel(task.dueDate)}</span></div></div><div className="flex shrink-0 gap-1 opacity-100 sm:opacity-0 sm:transition group-hover:opacity-100 group-focus-within:opacity-100"><button onClick={onEdit} aria-label={`Edit ${task.title}`} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-ink">✎</button><button onClick={onDelete} aria-label={`Delete ${task.title}`} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">×</button></div></li>;
}

function TaskModal({ task, busy, onClose, onSave }) {
  const initial = task ? { ...task, dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '' } : blank;
  function submit(event) { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); values.estimatedDuration = Number(values.estimatedDuration); onSave(values); }
  return <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-labelledby="task-modal-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-white p-5 shadow-xl sm:p-7"><div className="flex items-start justify-between"><div><h2 id="task-modal-title" className="text-lg font-semibold">{task ? 'Edit task' : 'Create a task'}</h2><p className="mt-1 text-sm text-muted">Keep it clear, then get it off your mind.</p></div><button onClick={onClose} aria-label="Close" className="rounded-md px-2 text-xl text-slate-400 hover:bg-slate-100">×</button></div><form onSubmit={submit} className="mt-6 space-y-4">
    <Field label="Task title" name="title" required maxLength="120" defaultValue={initial.title} placeholder="What needs to get done?" />
    <label className="block text-sm font-medium text-slate-700">Description <textarea name="description" maxLength="1000" defaultValue={initial.description} rows="3" placeholder="Add a few details (optional)" className="mt-1.5 block w-full resize-y rounded-lg border border-line px-3 py-2.5 text-sm placeholder:text-slate-400" /></label>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Due date" name="dueDate" type="date" defaultValue={initial.dueDate} required /><label className="block text-sm font-medium text-slate-700">Priority<select name="priority" defaultValue={initial.priority} className="mt-1.5 block w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Category" name="category" maxLength="40" defaultValue={initial.category} placeholder="General" required /><Field label="Estimated minutes" name="estimatedDuration" type="number" min="1" step="1" defaultValue={initial.estimatedDuration} required /></div>
    <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button><button disabled={busy} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? 'Saving…' : task ? 'Save changes' : 'Add task'}</button></div>
  </form></section></div>;
}

function Field({ label, name, type = 'text', ...props }) { return <label className="block text-sm font-medium text-slate-700">{label}<input name={name} type={type} className="mt-1.5 block w-full rounded-lg border border-line px-3 py-2.5 text-sm placeholder:text-slate-400" {...props} /></label>; }
function Stat({ label, value, hint, symbol, alert }) { return <div className="rounded-xl border border-line bg-white p-4 sm:p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-muted sm:text-sm">{label}</span><span className={`grid h-8 w-8 place-items-center rounded-lg text-sm ${alert ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-accent'}`}>{symbol}</span></div><div className={`mt-3 text-2xl font-semibold tracking-tight ${alert ? 'text-rose-600' : ''}`}>{value}</div><p className="mt-1 text-[11px] text-slate-400 sm:text-xs">{hint}</p></div>; }
function BrandMark() { return <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm text-white">✓</span>; }
function formatMinutes(minutes) { if (minutes < 60) return `${minutes} min`; const hours = Math.floor(minutes / 60); const rest = minutes % 60; return `${hours}h${rest ? ` ${rest}m` : ''}`; }

export default App;
