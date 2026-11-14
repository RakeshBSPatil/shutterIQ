import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, CheckCircle2, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { extractErrorMessage } from '../api/client.js';

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'register') {
        await register({ name: name.trim(), email: email.trim(), password });
      } else {
        await login({ email: email.trim(), password });
      }
      navigate('/');
    } catch (err) {
      setError(extractErrorMessage(err, 'Authentication failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      {/* Left hero panel */}
      <aside className="bg-navy-900 text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-navy-950 shadow-md">
              <Bus className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <span className="text-2xl font-extrabold tracking-tight">
                Shuttle<span className="text-emerald-400">IQ</span>
              </span>
              <p className="text-xs text-slate-400 font-medium">
                AI-Powered Smart Mobility Coordinator
              </p>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-4">
            Replace spreadsheet shuttle rosters with weather-aware, optimized dispatch.
          </h1>
          <p className="text-slate-300 text-base leading-relaxed max-w-xl mb-10">
            Assign riders by geography and capacity instead of sign-up order, order stops
            with 2-opt routing, back-solve departures for traffic and weather, and simulate
            disruptions before the morning run begins.
          </p>

          <ul className="space-y-4 text-sm text-slate-200">
            <li className="flex items-start gap-3">
              <CheckCircle2
                className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                <strong className="text-white">Capacity-Constrained Optimization:</strong>{' '}
                Farthest-point seeding, regret-based clustering, 2-opt stop sequencing, and
                fixed-point departure scheduling.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck
                className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                <strong className="text-white">Probabilistic Delay &amp; Risk Model:</strong>{' '}
                Scores arrival lateness risk against your buffer using weather, road
                incidents, and hourly congestion curves.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Sparkles
                className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                <strong className="text-white">Privacy-Safe Gemini Copilot:</strong>{' '}
                Generates dispatch insights, rider alerts, and grounded Q&amp;A without
                sharing rider addresses or coordinates.
              </span>
            </li>
          </ul>
        </div>

        <p className="text-xs text-slate-400 mt-10 pt-6 border-t border-navy-800">
          Built for transport coordinators managing campus, school, and office shuttle fleets.
        </p>
      </aside>

      {/* Right auth panel */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex gap-2 p-1 rounded-xl bg-slate-100 mb-6" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors min-h-[44px] ${
                mode === 'login'
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors min-h-[44px] ${
                mode === 'register'
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create account
            </button>
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-1">
            {mode === 'login' ? 'Welcome back, coordinator' : 'Start optimizing your fleet'}
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            {mode === 'login'
              ? 'Sign in to manage your vehicles, riders, and morning dispatch plans.'
              : 'Create your coordinator workspace and load demo data in one click.'}
          </p>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Full name
                </label>
                <input
                  id="auth-name"
                  name="name"
                  type="text"
                  required
                  minLength={2}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 min-h-[46px]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Work email
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coordinator@campus.org"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 min-h-[46px]"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'register' ? 6 : 1}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-11 text-base text-slate-900 min-h-[46px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-3 px-4 transition-colors min-h-[48px] shadow-sm"
            >
              {submitting
                ? mode === 'login'
                  ? 'Signing in...'
                  : 'Creating workspace...'
                : mode === 'login'
                ? 'Sign in to ShuttleIQ'
                : 'Create account'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
