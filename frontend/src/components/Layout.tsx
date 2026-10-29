import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  HiOutlineCollection, HiOutlineSearch, HiOutlineGlobeAlt, HiOutlineClipboardCheck,
  HiOutlineCog, HiOutlineUser, HiOutlineLogout, HiOutlineMenu, HiOutlineX, HiOutlineMicrophone,
} from 'react-icons/hi';
import { useAuth } from '../lib/auth';
import { syncPending, usePendingUploads } from '../lib/offline';
import { useToast } from '../lib/toast';
import { initials } from '../lib/format';
import { ButtonLink, LotusMark } from './ui';

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-sunken"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lotus-100 text-sm font-semibold text-lotus-600">
          {initials(user.display_name)}
        </span>
        <span className="hidden lg:inline text-sm text-ink-soft max-w-32 truncate">{user.display_name}</span>
      </button>
      {open && (
        <div className="animate-fade-up absolute right-0 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-lift z-50">
          <div className="px-3 py-2 border-b border-line mb-1">
            <p className="text-sm font-medium text-ink truncate">{user.display_name}</p>
            <p className="text-xs text-muted truncate">{user.email}</p>
            <p className="mt-1 text-xs font-medium capitalize text-saffron-700">{user.role}</p>
          </div>
          <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-sunken no-underline">
            <HiOutlineUser className="w-4 h-4" /> Profile & password
          </Link>
          <button
            onClick={() => { logout(); setOpen(false); navigate('/'); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-sunken"
          >
            <HiOutlineLogout className="w-4 h-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Recordings saved while offline: how many are waiting, sent automatically once there's a connection. */
function PendingUploads() {
  const { count, busy, online } = usePendingUploads();
  if (online && !count) return null;
  const label = !online
    ? count ? `Offline · ${count} saved` : 'Offline'
    : busy ? `Uploading ${count}…` : `${count} waiting`;
  return (
    <button
      type="button"
      onClick={() => online && syncPending()}
      title={online ? 'Recordings saved on this device. Click to upload now.' : 'No internet. You can still record; it uploads later.'}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        online ? 'bg-saffron-50 text-saffron-700' : 'bg-sunken text-ink-soft'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${online ? (busy ? 'animate-pulse bg-saffron-500' : 'bg-saffron-500') : 'bg-faint'}`} />
      {label}
    </button>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isVerifier = user?.role === 'verifier' || user?.role === 'admin';

  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Send recordings that were saved while offline, now and whenever the connection returns.
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => {
    if (!user) return;
    const go = () => syncPending().then((n) => {
      if (n) toastRef.current.success(`${n} saved ${n === 1 ? 'recording' : 'recordings'} uploaded.`);
    });
    go();
    window.addEventListener('online', go);
    return () => window.removeEventListener('online', go);
  }, [user]);

  const links = [
    { to: '/recordings', icon: HiOutlineCollection, label: 'Archive' },
    { to: '/search', icon: HiOutlineSearch, label: 'Search' },
    { to: '/dialects', icon: HiOutlineGlobeAlt, label: 'Dialects' },
    ...(user ? [{ to: '/review', icon: HiOutlineClipboardCheck, label: 'Review' }] : []),
    ...(isVerifier ? [{ to: '/manage', icon: HiOutlineCog, label: 'Manage' }] : []),
  ];

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-[15px] no-underline transition-colors ${
      isActive ? 'bg-saffron-50 text-saffron-700 font-medium' : 'text-ink-soft hover:bg-sunken hover:text-ink'
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 no-underline shrink-0" aria-label="SwaraVeda home">
            <LotusMark className="w-8 h-8" />
            <span className="font-display text-[1.35rem] font-bold tracking-tight text-ink">
              Swara<span className="text-saffron-600">Veda</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 ml-4" aria-label="Main">
            {links.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={navClass}>
                <Icon className="w-[18px] h-[18px]" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center md:hidden">{user && <PendingUploads />}</div>
          <div className="ml-auto hidden md:flex items-center gap-2">
            {user ? (
              <>
                <PendingUploads />
                <ButtonLink to="/recordings/new" size="sm" icon={<HiOutlineMicrophone className="w-4 h-4" />}>
                  Record
                </ButtonLink>
                <UserMenu />
              </>
            ) : (
              <>
                <ButtonLink to="/login" variant="ghost" size="sm">Sign in</ButtonLink>
                <ButtonLink to="/register" size="sm">Join the archive</ButtonLink>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="ml-auto md:hidden rounded-lg p-2 text-ink-soft hover:bg-sunken"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <HiOutlineX className="w-6 h-6" /> : <HiOutlineMenu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-line bg-paper px-4 pb-4 pt-2 space-y-1">
            {links.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={navClass}>
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            ))}
            <div className="pt-3 mt-2 border-t border-line flex flex-col gap-2">
              {user ? (
                <>
                  <ButtonLink to="/recordings/new" icon={<HiOutlineMicrophone className="w-5 h-5" />}>Record</ButtonLink>
                  <NavLink to="/profile" className={navClass}><HiOutlineUser className="w-5 h-5" />{user.display_name}</NavLink>
                  <button onClick={logout} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[15px] text-ink-soft hover:bg-sunken">
                    <HiOutlineLogout className="w-5 h-5" /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <ButtonLink to="/register">Join the archive</ButtonLink>
                  <ButtonLink to="/login" variant="secondary">Sign in</ButtonLink>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main" className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-6 text-sm text-muted">
          <p className="flex items-center gap-2">
            <LotusMark className="w-5 h-5" />
            SwaraVeda · keeping endangered voices alive
          </p>
          <p>Recordings belong to the communities who share them.</p>
        </div>
      </footer>
    </div>
  );
}
