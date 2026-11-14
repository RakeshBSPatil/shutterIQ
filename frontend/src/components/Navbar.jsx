import { NavLink, useNavigate } from 'react-router-dom';
import { Bus, LayoutDashboard, LogOut, MapPin, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/auth');
  }

  const navLinkClass = ({ isActive }) =>
    `inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors min-h-[44px] border-b-2 ${
      isActive
        ? 'bg-navy-800 text-emerald-400 border-emerald-400'
        : 'text-slate-300 border-transparent hover:text-white hover:bg-navy-800/70'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-navy-900 text-white border-b border-navy-800 shadow-sm">
      <a href="#main-content" className="skip-link visually-hidden">
        Skip to main content
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="flex items-center gap-2.5 group">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-navy-950 shadow-sm">
                <Bus className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <span className="text-lg font-extrabold tracking-tight text-white">
                  Shuttle<span className="text-emerald-400">IQ</span>
                </span>
                <span className="hidden sm:block text-[11px] font-medium text-slate-400 leading-none">
                  Smart Mobility Planner
                </span>
              </div>
            </NavLink>

            <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
              <NavLink
                to="/"
                end
                className={navLinkClass}
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/fleet" className={navLinkClass}>
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <span>Fleet &amp; Riders</span>
              </NavLink>
              <NavLink to="/plans/new" className={navLinkClass}>
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                <span>New Plan</span>
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-sm font-semibold text-white">{user?.name}</span>
              <span className="text-xs text-slate-400">{user?.email}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700 bg-navy-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-navy-700 hover:text-white transition-colors min-h-[44px]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
