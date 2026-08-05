import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import { toggleTheme } from '../../store/slices/themeSlice';
import {
  Sun, Moon, Menu, X, ChevronDown,
  User, LayoutDashboard, Calendar, LogOut, Zap,
} from 'lucide-react';
import clsx from 'clsx';
import NotificationBell from '../ui/NotificationBell';

const navLinks = [
  { label: 'Interviewers', to: '/interviewers' },
  { label: 'Pricing', to: '/subscriptions' },
];

export default function Navbar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { mode } = useAppSelector((s) => s.theme);
  const { user, isAuthenticated } = useAppSelector((s) => s.auth);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    setDropdownOpen(false);
    navigate('/');
  };

  return (
    <>
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={clsx(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-[var(--border)] shadow-sm'
            : 'bg-transparent'
        )}
      >
        <div className="container-xl flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span>InterviewReady</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  clsx('btn-ghost', isActive && 'text-[var(--accent)]')
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => dispatch(toggleTheme())}
              className="btn-ghost w-9 h-9 p-0 rounded-full"
              aria-label="Toggle theme"
            >
              {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {isAuthenticated && <NotificationBell />}

            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 btn-ghost rounded-full pr-3"
                >
                  <img
                    src={user?.avatar || `https://i.pravatar.cc/40?u=${user?.id}`}
                    alt={user?.name}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  <span className="hidden sm:block text-sm font-medium">{user?.name?.split(' ')[0]}</span>
                  <ChevronDown size={14} className={clsx('transition-transform', dropdownOpen && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-52 glass-card p-1 rounded-2xl"
                    >
                      <DropItem icon={<User size={15} />} label="Profile" to="/profile" onClick={() => setDropdownOpen(false)} />
                      <DropItem icon={<Calendar size={15} />} label="My Bookings" to="/bookings" onClick={() => setDropdownOpen(false)} />
                      {user?.role === 'admin' && (
                        <DropItem icon={<LayoutDashboard size={15} />} label="Admin" to="/admin" onClick={() => setDropdownOpen(false)} />
                      )}
                      <hr className="my-1 border-[var(--border)]" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <LogOut size={15} />
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link to="/login" className="btn-ghost hidden sm:inline-flex">Sign in</Link>
                <Link to="/signup" className="btn-primary">Get started</Link>
              </>
            )}

            <button
              className="btn-ghost md:hidden w-9 h-9 p-0"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed inset-x-0 top-16 z-40 glass border-b border-[var(--border)] px-4 py-4 md:hidden"
          >
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-3 rounded-xl text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors"
              >
                {l.label}
              </NavLink>
            ))}
            {!isAuthenticated && (
              <div className="flex gap-2 mt-3">
                <Link to="/login" className="flex-1 btn-secondary text-center" onClick={() => setMobileOpen(false)}>Sign in</Link>
                <Link to="/signup" className="flex-1 btn-primary text-center" onClick={() => setMobileOpen(false)}>Get started</Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function DropItem({
  icon, label, to, onClick,
}: {
  icon: React.ReactNode; label: string; to: string; onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
    >
      <span className="text-[var(--text-secondary)]">{icon}</span>
      {label}
    </Link>
  );
}
