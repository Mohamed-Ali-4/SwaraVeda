import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { HiOutlineMicrophone, HiOutlineSearch, HiOutlineGlobeAlt, HiOutlineChartBar, HiOutlineUser, HiOutlineLogout, HiOutlineLogin, HiOutlineMenu, HiOutlineX } from 'react-icons/hi';
import { useState } from 'react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/', icon: <HiOutlineChartBar className="w-5 h-5" />, label: 'Dashboard' },
    { to: '/recordings', icon: <HiOutlineMicrophone className="w-5 h-5" />, label: 'Recordings' },
    { to: '/dialects', icon: <HiOutlineGlobeAlt className="w-5 h-5" />, label: 'Dialects' },
    { to: '/search', icon: <HiOutlineSearch className="w-5 h-5" />, label: 'Search' },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 text-amber-700 font-bold text-xl no-underline">
              <span className="text-2xl">🪷</span>
              SwaraVeda
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 no-underline transition-colors"
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <>
                  <Link to="/profile" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100 no-underline">
                    <HiOutlineUser className="w-5 h-5" />
                    {user.display_name}
                  </Link>
                  <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-stone-500 hover:bg-stone-100 cursor-pointer">
                    <HiOutlineLogout className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <Link to="/login" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-amber-600 text-white hover:bg-amber-700 no-underline">
                  <HiOutlineLogin className="w-5 h-5" />
                  Sign In
                </Link>
              )}
            </div>

            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-stone-600 cursor-pointer">
              {menuOpen ? <HiOutlineX className="w-6 h-6" /> : <HiOutlineMenu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-stone-200 bg-white px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-stone-600 hover:bg-stone-100 no-underline"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
            {user ? (
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-stone-500 hover:bg-stone-100 w-full cursor-pointer">
                <HiOutlineLogout className="w-5 h-5" />
                Sign Out
              </button>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-amber-600 no-underline">
                <HiOutlineLogin className="w-5 h-5" />
                Sign In
              </Link>
            )}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-stone-400">
          SwaraVeda — Preserving endangered dialects & oral traditions
        </div>
      </footer>
    </div>
  );
}
