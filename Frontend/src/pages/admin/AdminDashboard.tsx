import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Calendar, DollarSign, TrendingUp,
  Search, CheckCircle, XCircle, Clock,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';
import Badge from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loader';
import {
  useAdminStats,
  useAdminUsers,
  useAdminInterviewers,
  useAdminBookings,
  useApproveInterviewer,
  useRejectInterviewer,
  useAdminUpdateUser,
} from '../../hooks/useApi';
import type { Interviewer, User, Booking, AdminStats } from '../../types';
import { formatDate } from '../../lib/dateUtils';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const ADMIN_TABS = ['Overview', 'Users', 'Interviewers', 'Bookings'] as const;
type Tab = typeof ADMIN_TABS[number];

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, change, icon, up }: {
  label: string; value: string | number; change?: string; icon: React.ReactNode; up?: boolean;
}) {
  return (
    <GlassCard className="flex items-start gap-4 p-5">
      <div className="p-3 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        {change && (
          <p className={`text-xs mt-1 flex items-center gap-0.5 ${up ? 'text-emerald-500' : 'text-red-500'}`}>
            {up ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {change} vs last month
          </p>
        )}
      </div>
    </GlassCard>
  );
}

// ─── Revenue Chart (SVG bar chart) ───────────────────────────────────────────
function RevenueChart({ data }: { data: AdminStats['monthlyRevenue'] }) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const chartH = 80;

  return (
    <div>
      <div className="flex items-end gap-2 h-24">
        {data.map((d, i) => {
          const h = Math.max(4, (d.revenue / max) * chartH);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className="w-full rounded-t-lg bg-[var(--accent)]/70 hover:bg-[var(--accent)] transition-colors cursor-default"
                style={{ height: h }}
              />
              <span className="text-[9px] text-[var(--text-secondary)] truncate w-full text-center">
                {MONTHS[d._id.month - 1]}
              </span>
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] whitespace-nowrap z-10">
                ₹{d.revenue.toLocaleString()} · {d.count} txns
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [search, setSearch] = useState('');
  const [dSearch, setDSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminUsers({ page, search: dSearch || undefined });
  const updateUser = useAdminUpdateUser();
  const users = data?.data ?? [];

  const toggleActive = (user: User) => {
    updateUser.mutate(
      { id: user._id, updates: { isActive: !user.isActive } },
      {
        onSuccess: () => toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`),
        onError: () => toast.error('Failed to update user'),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setTimeout(() => setDSearch(e.target.value), 400); setPage(1); }}
          placeholder="Search users…"
          className="input-field pl-10 w-full sm:w-72"
        />
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="glass-card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b border-[var(--border)] hover:bg-[var(--glass)] transition-colors">
                  <td className="px-4 py-3 font-medium">{user.firstName} {user.lastName}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] truncate max-w-[180px]">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge label={user.role} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(user)}
                      className="text-xs text-[var(--accent)] hover:opacity-80 font-medium"
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="text-center py-8 text-[var(--text-secondary)] text-sm">No users found</p>}
        </div>
      )}
    </div>
  );
}

// ─── Interviewers Tab ─────────────────────────────────────────────────────────
function InterviewersTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useAdminInterviewers({ status: statusFilter || undefined });
  const approve = useApproveInterviewer();
  const reject = useRejectInterviewer();
  const interviewers = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['', 'pending', 'active', 'rejected', 'suspended'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="glass-card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Name', 'Company', 'Expertise', 'Rating', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {interviewers.map((iv: Interviewer) => {
                const user = typeof iv.user === 'object' ? iv.user : null;
                return (
                  <tr key={iv._id} className="border-b border-[var(--border)] hover:bg-[var(--glass)] transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {user ? `${user.firstName} ${user.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{iv.company}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {iv.expertise.slice(0, 2).map((e) => (
                          <Badge key={e} label={e} small />
                        ))}
                        {iv.expertise.length > 2 && (
                          <span className="text-xs text-[var(--text-secondary)]">+{iv.expertise.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-amber-500 font-medium">
                      ★ {iv.rating.average.toFixed(1)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        iv.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : iv.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {iv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {iv.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approve.mutate(iv._id, {
                              onSuccess: () => toast.success('Interviewer approved'),
                              onError: () => toast.error('Failed'),
                            })}
                            className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            title="Approve"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => reject.mutate({ id: iv._id }, {
                              onSuccess: () => toast.success('Interviewer rejected'),
                              onError: () => toast.error('Failed'),
                            })}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Reject"
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {interviewers.length === 0 && (
            <p className="text-center py-8 text-[var(--text-secondary)] text-sm">No interviewers found</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────
function BookingsTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useAdminBookings({ status: statusFilter || undefined });
  const bookings = data?.data ?? [];

  const statusColors: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['', 'confirmed', 'pending', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="glass-card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['User', 'Interviewer', 'Date', 'Type', 'Status', 'Amount'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking: Booking) => {
                const user = typeof booking.user === 'object' ? booking.user : null;
                const iv = typeof booking.interviewer === 'object' ? booking.interviewer : null;
                const ivUser = iv && typeof iv.user === 'object' ? iv.user : null;
                return (
                  <tr key={booking._id} className="border-b border-[var(--border)] hover:bg-[var(--glass)] transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {user ? `${user.firstName} ${user.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {ivUser ? `${ivUser.firstName} ${ivUser.lastName}` : booking.interviewerName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {formatDate(booking.scheduledDate ?? booking.date)}
                    </td>
                    <td className="px-4 py-3"><Badge label={booking.type} small /></td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[booking.status] ?? ''}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      ₹{booking.price?.toLocaleString() ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {bookings.length === 0 && <p className="text-center py-8 text-[var(--text-secondary)] text-sm">No bookings found</p>}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('Overview');
  const { data: stats, isLoading: statsLoading } = useAdminStats();

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

          {/* Overview Tab */}
          {tab === 'Overview' && (
            <div className="space-y-8">
              {statsLoading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : stats ? (
                <>
                  {/* KPIs */}
                  <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <KpiCard
                      label="Total Users"
                      value={stats.users.total.toLocaleString()}
                      change={`+${stats.users.newThisMonth} new`}
                      icon={<Users size={22} />}
                      up
                    />
                    <KpiCard
                      label="Bookings This Month"
                      value={stats.bookings.thisMonth.toLocaleString()}
                      icon={<Calendar size={22} />}
                    />
                    <KpiCard
                      label="Monthly Revenue"
                      value={`₹${stats.revenue.thisMonth.toLocaleString()}`}
                      icon={<DollarSign size={22} />}
                    />
                    <KpiCard
                      label="Active Subscriptions"
                      value={stats.activeSubscriptions.toLocaleString()}
                      icon={<TrendingUp size={22} />}
                    />
                  </div>

                  {/* Revenue Chart */}
                  {stats.monthlyRevenue.length > 0 && (
                    <GlassCard>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-[var(--text-primary)]">Revenue (Last 6 Months)</h3>
                        <span className="text-xs text-[var(--text-secondary)]">
                          Total: ₹{stats.revenue.total.toLocaleString()}
                        </span>
                      </div>
                      <RevenueChart data={stats.monthlyRevenue} />
                    </GlassCard>
                  )}

                  {/* Quick stats row */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <GlassCard className="text-center p-5">
                      <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{stats.interviewers.pending}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Pending Interviewer Applications</p>
                    </GlassCard>
                    <GlassCard className="text-center p-5">
                      <Users className="w-6 h-6 text-[var(--accent)] mx-auto mb-2" />
                      <p className="text-2xl font-bold">{stats.interviewers.total}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Active Interviewers</p>
                    </GlassCard>
                    <GlassCard className="text-center p-5">
                      <TrendingUp className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{stats.bookings.total.toLocaleString()}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Total Bookings</p>
                    </GlassCard>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {tab === 'Users' && <UsersTab />}
          {tab === 'Interviewers' && <InterviewersTab />}
          {tab === 'Bookings' && <BookingsTab />}
        </motion.div>
      </div>
    </main>
  );
}

// Made with Bob
