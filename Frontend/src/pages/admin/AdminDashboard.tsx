import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Calendar, DollarSign, TrendingUp,
  Search, MoreVertical, ChevronUp,
} from 'lucide-react';
import { mockInterviewers, mockBookings } from '../../data/mockData';
import GlassCard from '../../components/ui/GlassCard';
import Badge from '../../components/ui/Badge';
import clsx from 'clsx';

const kpis = [
  { label: 'Total Users', value: '12,480', change: '+18%', icon: <Users size={22} />, up: true },
  { label: 'Sessions This Month', value: '3,241', change: '+24%', icon: <Calendar size={22} />, up: true },
  { label: 'Monthly Revenue', value: '$94,200', change: '+12%', icon: <DollarSign size={22} />, up: true },
  { label: 'Avg. Rating', value: '4.85', change: '+0.05', icon: <TrendingUp size={22} />, up: true },
];

const RECENT_USERS = [
  { id: '1', name: 'Alex Rodriguez', email: 'alex.r@gmail.com', plan: 'pro', joined: '2025-07-22', status: 'active' },
  { id: '2', name: 'Priya Mehta', email: 'priya@startup.io', plan: 'enterprise', joined: '2025-07-21', status: 'active' },
  { id: '3', name: 'Jason Liu', email: 'jasonliu@outlook.com', plan: 'free', joined: '2025-07-20', status: 'inactive' },
  { id: '4', name: 'Maria Santos', email: 'maria.s@company.com', plan: 'pro', joined: '2025-07-19', status: 'active' },
  { id: '5', name: 'Ben Walker', email: 'ben.w@gmail.com', plan: 'free', joined: '2025-07-18', status: 'active' },
];

const ADMIN_TABS = ['Overview', 'Users', 'Interviewers', 'Bookings'];

export default function AdminDashboard() {
  const [tab, setTab] = useState('Overview');
  const [search, setSearch] = useState('');

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-label mb-1">Admin</p>
              <h1 className="text-3xl font-bold">Dashboard</h1>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-8 bg-[var(--bg-secondary)] rounded-2xl p-1 border border-[var(--border)] overflow-x-auto">
            {ADMIN_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  'flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                  tab === t
                    ? 'bg-white dark:bg-[#2c2c2e] shadow text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Overview */}
          {tab === 'Overview' && (
            <div className="space-y-8">
              {/* KPIs */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((k, i) => (
                  <motion.div
                    key={k.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                  >
                    <GlassCard>
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-11 h-11 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                          {k.icon}
                        </div>
                        <span className={clsx(
                          'flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-full',
                          k.up ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600'
                        )}>
                          <ChevronUp size={12} className={clsx(!k.up && 'rotate-180')} />
                          {k.change}
                        </span>
                      </div>
                      <p className="text-2xl font-bold">{k.value}</p>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">{k.label}</p>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>

              {/* Revenue chart placeholder */}
              <GlassCard>
                <h3 className="font-semibold mb-6">Revenue over time</h3>
                <div className="flex items-end gap-2 h-40">
                  {[42, 68, 55, 90, 78, 95, 115, 102, 130, 118, 140, 160].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ scaleY: 0, originY: 1 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: i * 0.04 }}
                      style={{ height: `${(h / 160) * 100}%` }}
                      className="flex-1 rounded-t-lg bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 transition-colors cursor-pointer"
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-[var(--text-secondary)]">
                  {['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              </GlassCard>

              {/* Recent bookings */}
              <GlassCard>
                <h3 className="font-semibold mb-4">Recent bookings</h3>
                <div className="space-y-2">
                  {mockBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
                      <div>
                        <p className="text-sm font-medium">{b.interviewerName}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{b.type} · {b.date} {b.slot}</p>
                      </div>
                      <Badge label={b.status} />
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          )}

          {/* Users tab */}
          {tab === 'Users' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1 max-w-xs">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="input-field pl-9 text-sm"
                  />
                </div>
              </div>
              <GlassCard padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] text-xs uppercase tracking-wide">
                        <th className="text-left px-5 py-3 font-medium">User</th>
                        <th className="text-left px-5 py-3 font-medium">Plan</th>
                        <th className="text-left px-5 py-3 font-medium">Joined</th>
                        <th className="text-left px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {RECENT_USERS.filter((u) =>
                        !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
                      ).map((u) => (
                        <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors">
                          <td className="px-5 py-4">
                            <div>
                              <p className="font-medium">{u.name}</p>
                              <p className="text-xs text-[var(--text-secondary)]">{u.email}</p>
                            </div>
                          </td>
                          <td className="px-5 py-4"><Badge label={u.plan} /></td>
                          <td className="px-5 py-4 text-[var(--text-secondary)]">{u.joined}</td>
                          <td className="px-5 py-4">
                            <span className={clsx(
                              'px-2.5 py-1 rounded-full text-xs font-medium',
                              u.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                            )}>
                              {u.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <button className="btn-ghost w-8 h-8 p-0 rounded-full">
                              <MoreVertical size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          )}

          {/* Interviewers tab */}
          {tab === 'Interviewers' && (
            <GlassCard padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] text-xs uppercase tracking-wide">
                      <th className="text-left px-5 py-3 font-medium">Interviewer</th>
                      <th className="text-left px-5 py-3 font-medium">Company</th>
                      <th className="text-left px-5 py-3 font-medium">Sessions</th>
                      <th className="text-left px-5 py-3 font-medium">Rating</th>
                      <th className="text-left px-5 py-3 font-medium">Price</th>
                      <th className="text-left px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockInterviewers.map((iv) => (
                      <tr key={iv.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <img src={iv.avatar} alt={iv.name} className="w-8 h-8 rounded-full" />
                            <div>
                              <p className="font-medium">{iv.name}</p>
                              <p className="text-xs text-[var(--text-secondary)]">{iv.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[var(--text-secondary)]">{iv.company}</td>
                        <td className="px-5 py-4">{iv.sessions}</td>
                        <td className="px-5 py-4">{iv.rating}</td>
                        <td className="px-5 py-4">${iv.price}</td>
                        <td className="px-5 py-4">
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-medium',
                            iv.available
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                          )}>
                            {iv.available ? 'Active' : 'Unavailable'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* Bookings tab */}
          {tab === 'Bookings' && (
            <GlassCard>
              <h3 className="font-semibold mb-5">All Bookings</h3>
              <div className="space-y-2">
                {mockBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors">
                    <div>
                      <p className="font-medium text-sm">{b.interviewerName}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{b.type} · {b.date} · {b.slot}</p>
                    </div>
                    <Badge label={b.status} />
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </motion.div>
      </div>
    </main>
  );
}
