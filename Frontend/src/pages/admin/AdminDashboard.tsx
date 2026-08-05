import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Calendar, DollarSign, TrendingUp, Search,
  CheckCircle, XCircle, Clock, ChevronUp, ChevronDown,
  Star, RefreshCw, Ban, Mail, Bell, Megaphone, Send,
  Trash2, Edit3, Award, BarChart3, ShieldCheck,
  PauseCircle, PlayCircle, Plus, ExternalLink,
} from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loader';
import {
  useAdminStats, useAdminUserAnalytics,
  useAdminUsers, useAdminUpdateUser,
  useAdminInterviewers, useApproveInterviewer, useRejectInterviewer,
  useSuspendInterviewer, useReactivateInterviewer,
  useAdminBookings, useAdminCancelBooking,
  useAdminPayments, usePaymentAnalytics, useAdminInitiateRefund,
  useAdminSubscriptions, useSubscriptionAnalytics, useAdminUpdateSubscription,
  useAdminReviews, useAdminModerateReview, usePromoteReviewToTestimonial,
  useAdminTestimonials, useCreateTestimonial, useUpdateTestimonial, useDeleteTestimonial,
  useAdminCampaigns, useCreateCampaign, useUpdateCampaign,
  useScheduleCampaign, useCancelCampaign, useDeleteCampaign,
  useAdminBroadcastNotifications, useSendPlatformNotification,
} from '../../hooks/useApi';
import type {
  Interviewer, User, Booking, Payment,
  Subscription, Review, Testimonial, EmailCampaign, BroadcastNotification,
} from '../../types';
import { formatDate, formatDistanceToNow } from '../../lib/dateUtils';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',       label: 'Overview',       icon: BarChart3 },
  { id: 'users',          label: 'Users',           icon: Users },
  { id: 'interviewers',   label: 'Interviewers',    icon: ShieldCheck },
  { id: 'bookings',       label: 'Bookings',        icon: Calendar },
  { id: 'payments',       label: 'Payments',        icon: DollarSign },
  { id: 'subscriptions',  label: 'Subscriptions',   icon: Award },
  { id: 'reviews',        label: 'Reviews',         icon: Star },
  { id: 'testimonials',   label: 'Testimonials',    icon: Megaphone },
  { id: 'campaigns',      label: 'Campaigns',       icon: Mail },
  { id: 'notifications',  label: 'Notifications',   icon: Bell },
] as const;
type TabId = typeof TABS[number]['id'];

// ─── Shared Primitives ────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function BarChart({
  data, labelKey, valueKey, height = 80, color = 'var(--accent)',
}: {
  data: Record<string, unknown>[];
  labelKey: string; valueKey: string; height?: number; color?: string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) ?? 0), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(3, (Number(d[valueKey]) / max) * (height - 16));
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative cursor-default">
            <div
              className="w-full rounded-t-md transition-opacity hover:opacity-80"
              style={{ height: h, background: color }}
            />
            <span className="text-[8px] text-[var(--text-secondary)] truncate w-full text-center leading-none">
              {String(d[labelKey])}
            </span>
            <div className="absolute bottom-full mb-1 pointer-events-none hidden group-hover:flex bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs whitespace-nowrap z-20 shadow-lg">
              {String(d[labelKey])}: <strong className="ml-1">{Number(d[valueKey]).toLocaleString()}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let cumAngle = -90;
  const R = 38; const cx = 50; const cy = 50;
  const paths = slices.map((s) => {
    const pct = s.value / total;
    const startAngle = cumAngle;
    const sweep = pct * 360;
    cumAngle += sweep;
    const toRad = (a: number) => (a * Math.PI) / 180;
    const x1 = cx + R * Math.cos(toRad(startAngle));
    const y1 = cy + R * Math.sin(toRad(startAngle));
    const x2 = cx + R * Math.cos(toRad(startAngle + sweep));
    const y2 = cy + R * Math.sin(toRad(startAngle + sweep));
    const large = sweep > 180 ? 1 : 0;
    return { ...s, d: `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z` };
  });
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-20 h-20 flex-shrink-0">
        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} opacity={0.85} />)}
        <circle cx={cx} cy={cy} r={22} fill="var(--bg-primary, #fff)" />
      </svg>
      <div className="space-y-1 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-[var(--text-secondary)] truncate">{s.label}</span>
            <span className="font-semibold ml-auto pl-2">{s.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon, trend,
}: { label: string; value: string | number; sub?: string; icon: React.ReactNode; trend?: { up: boolean; text: string } }) {
  return (
    <GlassCard className="flex items-start gap-4 p-5">
      <div className="p-3 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--text-secondary)] mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-[var(--text-primary)] leading-tight">{value}</p>
        {sub && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</p>}
        {trend && (
          <p className={`text-xs mt-1 flex items-center gap-0.5 ${trend.up ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend.up ? <ChevronUp size={11} /> : <ChevronDown size={11} />}{trend.text}
          </p>
        )}
      </div>
    </GlassCard>
  );
}

const statusPill = (status: string) => {
  const map: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    scheduled: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    suspended: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    flagged: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    refunded: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400',
    inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400',
    sending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
};

function TableWrap({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty: boolean }) {
  return (
    <div className="glass-card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <p className="text-center py-10 text-sm text-[var(--text-secondary)]">No records found</p>}
    </div>
  );
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2 items-center mb-4">{children}</div>;
}

function StatusChips({ values, active, onChange }: { values: string[]; active: string; onChange: (v: string) => void }) {
  return (
    <>
      {['', ...values].map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
            active === s ? 'bg-[var(--accent)] text-white' : 'border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
        </button>
      ))}
    </>
  );
}

function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input-field pl-9 text-sm w-full sm:w-64" />
    </div>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="glass-card w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg text-[var(--text-primary)]">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--glass)] text-[var(--text-secondary)]"><XCircle size={18} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: userAnalytics } = useAdminUserAnalytics();

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!stats) return null;

  const revenueChartData = stats.monthlyRevenue.map((d) => ({
    label: MONTHS[d._id.month - 1],
    value: d.revenue,
  }));

  const signupChartData = (stats.dailySignups ?? []).slice(-14).map((d) => ({
    label: d._id.slice(5),
    value: d.count,
  }));

  const PLAN_COLORS: Record<string, string> = { basic: '#60a5fa', pro: '#a78bfa', premium: '#34d399' };
  const planSlices = (stats.subsByPlan ?? []).map((p) => ({
    label: p._id.charAt(0).toUpperCase() + p._id.slice(1),
    value: p.count,
    color: PLAN_COLORS[p._id] ?? '#94a3b8',
  }));

  const roleSlices = (userAnalytics?.byRole ?? []).map((r, i) => ({
    label: r._id,
    value: r.count,
    color: ['#60a5fa', '#a78bfa', '#f59e0b', '#34d399'][i % 4],
  }));

  return (
    <div className="space-y-8">
      {/* KPI Row */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total Users" value={stats.users.total.toLocaleString()} icon={<Users size={20} />}
          trend={{ up: true, text: `+${stats.users.newThisMonth} this month` }} />
        <KpiCard label="Bookings This Month" value={stats.bookings.thisMonth.toLocaleString()}
          sub={`${stats.bookings.total.toLocaleString()} total`} icon={<Calendar size={20} />} />
        <KpiCard label="Monthly Revenue" value={`₹${stats.revenue.thisMonth.toLocaleString()}`}
          sub={`₹${stats.revenue.total.toLocaleString()} all time`} icon={<DollarSign size={20} />} />
        <KpiCard label="Active Subscriptions" value={stats.activeSubscriptions.toLocaleString()} icon={<TrendingUp size={20} />} />
      </div>

      {/* Second Row */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Pending Approvals" value={stats.interviewers.pending} icon={<Clock size={20} />} />
        <KpiCard label="Flagged Reviews" value={stats.pendingReviews} icon={<Star size={20} />} />
        <KpiCard label="Total Refunds" value={stats.totalRefunds} icon={<RefreshCw size={20} />} />
        <KpiCard label="Scheduled Campaigns" value={stats.pendingCampaigns} icon={<Mail size={20} />} />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Revenue (Last 6 Months)</h3>
            <span className="text-xs text-[var(--text-secondary)]">Total ₹{stats.revenue.total.toLocaleString()}</span>
          </div>
          {revenueChartData.length > 0
            ? <BarChart data={revenueChartData} labelKey="label" valueKey="value" height={96} />
            : <p className="text-sm text-[var(--text-secondary)] py-8 text-center">No revenue data yet</p>}
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Daily Sign-ups (Last 14 Days)</h3>
          {signupChartData.length > 0
            ? <BarChart data={signupChartData} labelKey="label" valueKey="value" height={96} color="#a78bfa" />
            : <p className="text-sm text-[var(--text-secondary)] py-8 text-center">No sign-up data yet</p>}
        </GlassCard>
      </div>

      {/* Distribution Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {planSlices.length > 0 && (
          <GlassCard>
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Active Subscriptions by Plan</h3>
            <DonutChart slices={planSlices} />
          </GlassCard>
        )}
        {roleSlices.length > 0 && (
          <GlassCard>
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Users by Role</h3>
            <DonutChart slices={roleSlices} />
          </GlassCard>
        )}
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [search, setSearch] = useState('');
  const [dSearch, setDSearch] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [roleFilter, setRoleFilter] = useState('');
  const { data, isLoading } = useAdminUsers({ search: dSearch || undefined, role: roleFilter || undefined });
  const updateUser = useAdminUpdateUser();
  const users = data?.data ?? [];

  const onSearch = (v: string) => {
    setSearch(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDSearch(v), 400);
  };

  const toggleActive = (user: User) =>
    updateUser.mutate(
      { id: user._id, updates: { isActive: !user.isActive } },
      { onSuccess: () => toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`), onError: () => toast.error('Failed') }
    );

  const changeRole = (user: User, role: User['role']) =>
    updateUser.mutate(
      { id: user._id, updates: { role } },
      { onSuccess: () => toast.success('Role updated'), onError: () => toast.error('Failed') }
    );

  return (
    <div className="space-y-4">
      <FilterRow>
        <SearchInput value={search} onChange={onSearch} placeholder="Search by name or email…" />
        <StatusChips values={['user', 'interviewer', 'admin']} active={roleFilter} onChange={setRoleFilter} />
      </FilterRow>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <TableWrap headers={['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions']} empty={users.length === 0}>
          {users.map((user) => (
            <tr key={user._id} className="border-b border-[var(--border)] hover:bg-[var(--glass)] transition-colors">
              <td className="px-4 py-3 font-medium whitespace-nowrap">{user.firstName} {user.lastName}</td>
              <td className="px-4 py-3 text-[var(--text-secondary)] max-w-[180px] truncate">{user.email}</td>
              <td className="px-4 py-3">
                <select
                  value={user.role}
                  onChange={(e) => changeRole(user, e.target.value as User['role'])}
                  className="text-xs bg-transparent border border-[var(--border)] rounded-lg px-2 py-1"
                >
                  {['user', 'interviewer', 'admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td className="px-4 py-3">{statusPill(user.isActive ? 'active' : 'inactive')}</td>
              <td className="px-4 py-3 text-[var(--text-secondary)] text-xs whitespace-nowrap">{formatDate(user.createdAt)}</td>
              <td className="px-4 py-3">
                <button onClick={() => toggleActive(user)} className={`text-xs font-medium ${user.isActive ? 'text-red-500' : 'text-emerald-500'}`}>
                  {user.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </TableWrap>
      )}
    </div>
  );
}

// ─── Interviewers Tab ─────────────────────────────────────────────────────────

function InterviewersTab() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [rejecting, setRejecting] = useState<{ id: string; name: string } | null>(null);
  const [suspending, setSuspending] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useAdminInterviewers({ status: statusFilter || undefined });
  const approve = useApproveInterviewer();
  const reject = useRejectInterviewer();
  const suspend = useSuspendInterviewer();
  const reactivate = useReactivateInterviewer();
  const interviewers = data?.data ?? [];

  const doApprove = (id: string) =>
    approve.mutate(id, {
      onSuccess: () => toast.success('✅ Interviewer approved & notified'),
      onError: () => toast.error('Failed'),
    });

  const doReject = () => {
    if (!rejecting) return;
    reject.mutate(
      { id: rejecting.id, reason },
      {
        onSuccess: () => { toast.success('Interviewer rejected'); setRejecting(null); setReason(''); },
        onError: () => toast.error('Failed'),
      }
    );
  };

  const doSuspend = () => {
    if (!suspending) return;
    suspend.mutate(
      { id: suspending.id, reason },
      {
        onSuccess: () => { toast.success('Interviewer suspended'); setSuspending(null); setReason(''); },
        onError: () => toast.error('Failed'),
      }
    );
  };

  return (
    <div className="space-y-4">
      <FilterRow>
        <StatusChips values={['pending', 'active', 'rejected', 'suspended']} active={statusFilter} onChange={setStatusFilter} />
      </FilterRow>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <TableWrap headers={['Name', 'Company / Position', 'Expertise', 'Rating', 'Sessions', 'Status', 'Actions']} empty={interviewers.length === 0}>
          {interviewers.map((iv: Interviewer) => {
            const u = typeof iv.user === 'object' ? iv.user : null;
            return (
              <tr key={iv._id} className="border-b border-[var(--border)] hover:bg-[var(--glass)] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {u?.avatar
                      ? <img src={u.avatar} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/20 flex-shrink-0" />}
                    <div>
                      <p className="font-medium text-sm whitespace-nowrap">{u ? `${u.firstName} ${u.lastName}` : '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">
                  <p className="font-medium text-[var(--text-primary)]">{iv.company}</p>
                  <p>{iv.position}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {iv.expertise.slice(0, 2).map((e) => <Badge key={e} label={e} small />)}
                    {iv.expertise.length > 2 && <span className="text-xs text-[var(--text-secondary)]">+{iv.expertise.length - 2}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-amber-500 font-semibold text-sm">★ {iv.rating.average.toFixed(1)}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)] text-sm">{iv.completedInterviews}</td>
                <td className="px-4 py-3">{statusPill(iv.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {iv.status === 'pending' && (
                      <>
                        <button onClick={() => doApprove(iv._id)} title="Approve" className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                          <CheckCircle size={15} />
                        </button>
                        <button onClick={() => { setRejecting({ id: iv._id, name: u ? `${u.firstName} ${u.lastName}` : '?' }); setReason(''); }} title="Reject" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <XCircle size={15} />
                        </button>
                      </>
                    )}
                    {iv.status === 'active' && (
                      <button onClick={() => { setSuspending({ id: iv._id, name: u ? `${u.firstName} ${u.lastName}` : '?' }); setReason(''); }} title="Suspend" className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20">
                        <PauseCircle size={15} />
                      </button>
                    )}
                    {iv.status === 'suspended' && (
                      <button
                        onClick={() => reactivate.mutate(iv._id, { onSuccess: () => toast.success('Reactivated'), onError: () => toast.error('Failed') })}
                        title="Reactivate" className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      >
                        <PlayCircle size={15} />
                      </button>
                    )}
                    <a href={`/interviewers/${iv._id}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-[var(--accent)] hover:bg-[var(--glass)]" title="View profile">
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </TableWrap>
      )}

      {/* Reject modal */}
      {rejecting && (
        <Modal title={`Reject — ${rejecting.name}`} onClose={() => setRejecting(null)}>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Rejection reason (shown to applicant)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input-field w-full resize-none mb-4" placeholder="Optional…" />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" onClick={doReject} loading={reject.isPending}>Reject</Button>
          </div>
        </Modal>
      )}

      {/* Suspend modal */}
      {suspending && (
        <Modal title={`Suspend — ${suspending.name}`} onClose={() => setSuspending(null)}>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Reason for suspension</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input-field w-full resize-none mb-4" placeholder="Optional…" />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setSuspending(null)}>Cancel</Button>
            <Button variant="danger" onClick={doSuspend} loading={suspend.isPending}>Suspend</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [reason, setReason] = useState('');
  const { data, isLoading } = useAdminBookings({ status: statusFilter || undefined });
  const cancelBooking = useAdminCancelBooking();
  const bookings = data?.data ?? [];

  const doCancel = () => {
    if (!cancelling) return;
    cancelBooking.mutate(
      { id: cancelling._id, reason },
      {
        onSuccess: () => { toast.success('Booking cancelled & user notified'); setCancelling(null); setReason(''); },
        onError: () => toast.error('Failed'),
      }
    );
  };

  return (
    <div className="space-y-4">
      <FilterRow>
        <StatusChips values={['confirmed', 'pending', 'completed', 'cancelled']} active={statusFilter} onChange={setStatusFilter} />
      </FilterRow>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <TableWrap headers={['User', 'Interviewer', 'Date & Time', 'Type', 'Status', 'Amount', 'Actions']} empty={bookings.length === 0}>
          {bookings.map((b: Booking) => {
            const user = typeof b.user === 'object' ? b.user : null;
            const iv = typeof b.interviewer === 'object' ? b.interviewer : null;
            const ivUser = iv && typeof iv.user === 'object' ? iv.user : null;
            return (
              <tr key={b._id} className="border-b border-[var(--border)] hover:bg-[var(--glass)] transition-colors">
                <td className="px-4 py-3 font-medium text-sm whitespace-nowrap">{user ? `${user.firstName} ${user.lastName}` : '—'}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)] text-sm">{ivUser ? `${ivUser.firstName} ${ivUser.lastName}` : b.interviewerName ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                  {formatDate(b.scheduledDate ?? b.date)}<br />
                  <span className="text-[var(--text-primary)]">{b.startTime ?? b.slot}</span>
                </td>
                <td className="px-4 py-3"><Badge label={b.type} small /></td>
                <td className="px-4 py-3">{statusPill(b.status)}</td>
                <td className="px-4 py-3 font-semibold text-sm">₹{b.price?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-3">
                  {!['completed', 'cancelled'].includes(b.status) && (
                    <button
                      onClick={() => { setCancelling(b); setReason(''); }}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Cancel booking"
                    >
                      <Ban size={15} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </TableWrap>
      )}

      {cancelling && (
        <Modal title="Cancel Booking" onClose={() => setCancelling(null)}>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Cancel <strong>{cancelling.type}</strong> on {formatDate(cancelling.scheduledDate ?? cancelling.date)}? The user will be notified.
          </p>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Reason (optional)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input-field w-full resize-none mb-4" />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setCancelling(null)}>Back</Button>
            <Button variant="danger" onClick={doCancel} loading={cancelBooking.isPending}>Cancel Booking</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

function PaymentsTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const [refunding, setRefunding] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const { data, isLoading } = useAdminPayments({ status: statusFilter || undefined });
  const { data: analytics } = usePaymentAnalytics();
  const initRefund = useAdminInitiateRefund();
  const payments = data?.data ?? [];

  const doRefund = () => {
    if (!refunding) return;
    initRefund.mutate(
      { id: refunding._id, amount: refundAmount ? parseFloat(refundAmount) : undefined, reason: refundReason },
      {
        onSuccess: () => { toast.success('Refund initiated & user notified'); setRefunding(null); setRefundAmount(''); setRefundReason(''); },
        onError: () => toast.error('Failed'),
      }
    );
  };

  const methodChartData = (analytics?.byMethod ?? []).map((m) => ({ label: m._id, value: m.total }));
  const trendData = (analytics?.monthlyTrend ?? []).map((d) => ({ label: MONTHS[d._id.month - 1], value: d.revenue }));

  return (
    <div className="space-y-6">
      {/* Analytics mini-row */}
      {analytics && (
        <div className="grid sm:grid-cols-3 gap-4">
          <GlassCard className="p-4">
            <p className="text-xs text-[var(--text-secondary)] mb-1">Total Refunds</p>
            <p className="text-xl font-bold">{analytics.refundStats.count}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">₹{analytics.refundStats.totalRefunded.toLocaleString()} refunded</p>
          </GlassCard>
          {methodChartData.length > 0 && (
            <GlassCard className="p-4 col-span-2">
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Revenue by Method</p>
              <BarChart data={methodChartData} labelKey="label" valueKey="value" height={52} color="#34d399" />
            </GlassCard>
          )}
        </div>
      )}
      {trendData.length > 0 && (
        <GlassCard>
          <p className="text-sm font-semibold mb-3">Monthly Revenue Trend</p>
          <BarChart data={trendData} labelKey="label" valueKey="value" height={80} />
        </GlassCard>
      )}

      <FilterRow>
        <StatusChips values={['completed', 'pending', 'failed', 'refunded']} active={statusFilter} onChange={setStatusFilter} />
      </FilterRow>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <TableWrap headers={['User', 'Amount', 'Method', 'Status', 'Date', 'Reference', 'Actions']} empty={payments.length === 0}>
          {payments.map((p: Payment) => {
            const user = typeof p.user === 'object' ? p.user : null;
            return (
              <tr key={p._id} className="border-b border-[var(--border)] hover:bg-[var(--glass)] transition-colors">
                <td className="px-4 py-3 font-medium text-sm whitespace-nowrap">{user ? `${user.firstName} ${user.lastName}` : '—'}</td>
                <td className="px-4 py-3 font-semibold text-sm">₹{p.amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{p.paymentMethod}</td>
                <td className="px-4 py-3">{statusPill(p.status)}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)] font-mono truncate max-w-[120px]">{p.razorpayPaymentId ?? '—'}</td>
                <td className="px-4 py-3">
                  {p.status === 'completed' && (
                    <button
                      onClick={() => { setRefunding(p); setRefundAmount(String(p.amount)); setRefundReason(''); }}
                      className="p-1.5 rounded-lg text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                      title="Initiate refund"
                    >
                      <RefreshCw size={15} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </TableWrap>
      )}

      {refunding && (
        <Modal title="Initiate Refund" onClose={() => setRefunding(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Refund Amount (₹)</label>
              <input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} type="number" max={refunding.amount} className="input-field w-full" />
              <p className="text-xs text-[var(--text-secondary)] mt-1">Max: ₹{refunding.amount.toLocaleString()}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Reason</label>
              <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} rows={2} className="input-field w-full resize-none" />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setRefunding(null)}>Cancel</Button>
              <Button variant="primary" onClick={doRefund} loading={initRefund.isPending}>Initiate Refund</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Subscriptions Tab ────────────────────────────────────────────────────────

function SubscriptionsTab() {
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useAdminSubscriptions({ plan: planFilter || undefined, status: statusFilter || undefined });
  const { data: analytics } = useSubscriptionAnalytics();
  const updateSub = useAdminUpdateSubscription();
  const subs = data?.data ?? [];

  const planColors: Record<string, string> = { basic: '#60a5fa', pro: '#a78bfa', premium: '#34d399' };
  const planSlices = (analytics?.byPlan ?? []).map((p) => ({ label: p._id, value: p.count, color: planColors[p._id] ?? '#94a3b8' }));

  const monthlyNewData = (analytics?.monthlyNew ?? []).map((d) => ({ label: MONTHS[d._id.month - 1], value: d.count }));
  const churnData = (analytics?.churnData ?? []).map((d) => ({ label: MONTHS[d._id.month - 1], value: d.count }));

  return (
    <div className="space-y-6">
      {analytics && (
        <div className="grid sm:grid-cols-3 gap-4">
          <GlassCard className="p-4">
            <p className="text-xs text-[var(--text-secondary)] mb-1">MRR</p>
            <p className="text-2xl font-bold">₹{analytics.mrr.toLocaleString()}</p>
          </GlassCard>
          {planSlices.length > 0 && (
            <GlassCard className="p-4">
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Plan Distribution</p>
              <DonutChart slices={planSlices} />
            </GlassCard>
          )}
          {monthlyNewData.length > 0 && (
            <GlassCard className="p-4">
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">New Subs / Month</p>
              <BarChart data={monthlyNewData} labelKey="label" valueKey="value" height={56} color="#a78bfa" />
            </GlassCard>
          )}
        </div>
      )}

      {churnData.length > 0 && (
        <GlassCard>
          <p className="text-sm font-semibold mb-3">Churn (Cancellations + Expirations)</p>
          <BarChart data={churnData} labelKey="label" valueKey="value" height={64} color="#f87171" />
        </GlassCard>
      )}

      <FilterRow>
        <StatusChips values={['active', 'expired', 'cancelled', 'suspended']} active={statusFilter} onChange={setStatusFilter} />
        <StatusChips values={['basic', 'pro', 'premium']} active={planFilter} onChange={setPlanFilter} />
      </FilterRow>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <TableWrap headers={['User', 'Plan', 'Status', 'Usage', 'Expires', 'Actions']} empty={subs.length === 0}>
          {subs.map((sub: Subscription) => {
            const user = typeof sub.user === 'object' ? sub.user : null;
            return (
              <tr key={sub._id} className="border-b border-[var(--border)] hover:bg-[var(--glass)] transition-colors">
                <td className="px-4 py-3 font-medium text-sm whitespace-nowrap">
                  {user ? `${(user as User).firstName} ${(user as User).lastName}` : '—'}
                </td>
                <td className="px-4 py-3"><Badge label={sub.plan} /></td>
                <td className="px-4 py-3">{statusPill(sub.status)}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                  {sub.usage.interviewsUsed}/{sub.usage.interviewsLimit}
                  <div className="w-20 h-1 bg-[var(--border)] rounded-full mt-1">
                    <div className="h-1 bg-[var(--accent)] rounded-full" style={{ width: `${Math.min(100, (sub.usage.interviewsUsed / sub.usage.interviewsLimit) * 100)}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{formatDate(sub.endDate)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {sub.status === 'active' && (
                      <button
                        onClick={() => updateSub.mutate({ id: sub._id, status: 'suspended' }, { onSuccess: () => toast.success('Suspended'), onError: () => toast.error('Failed') })}
                        className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20" title="Suspend"
                      >
                        <PauseCircle size={15} />
                      </button>
                    )}
                    {sub.status === 'suspended' && (
                      <button
                        onClick={() => updateSub.mutate({ id: sub._id, status: 'active' }, { onSuccess: () => toast.success('Reactivated'), onError: () => toast.error('Failed') })}
                        className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Reactivate"
                      >
                        <PlayCircle size={15} />
                      </button>
                    )}
                    {['active', 'suspended'].includes(sub.status) && (
                      <button
                        onClick={() => updateSub.mutate({ id: sub._id, status: 'cancelled', reason: 'Admin cancelled' }, { onSuccess: () => toast.success('Cancelled'), onError: () => toast.error('Failed') })}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Cancel"
                      >
                        <XCircle size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </TableWrap>
      )}
    </div>
  );
}

// ─── Reviews Tab ──────────────────────────────────────────────────────────────

function ReviewsTab() {
  const [modFilter, setModFilter] = useState('flagged');
  const { data, isLoading } = useAdminReviews({ moderationStatus: modFilter || undefined });
  const moderate = useAdminModerateReview();
  const promote = usePromoteReviewToTestimonial();
  const reviews = data?.data ?? [];

  const act = (id: string, status: string) =>
    moderate.mutate(
      { id, status },
      { onSuccess: () => toast.success(`Review ${status}`), onError: () => toast.error('Failed') }
    );

  return (
    <div className="space-y-4">
      <FilterRow>
        <StatusChips values={['approved', 'flagged', 'rejected', 'pending']} active={modFilter} onChange={setModFilter} />
      </FilterRow>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="space-y-3">
          {reviews.length === 0 && <p className="text-center py-12 text-[var(--text-secondary)] text-sm">No reviews found</p>}
          {reviews.map((r: Review) => {
            const user = typeof r.user === 'object' ? r.user : null;
            const ivUser = typeof r.interviewer === 'object' && typeof r.interviewer.user === 'object'
              ? r.interviewer.user : null;
            return (
              <div key={r._id} className="glass-card space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 flex-shrink-0 flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{user ? `${user.firstName} ${user.lastName}` : '—'}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        → {ivUser ? `${ivUser.firstName} ${ivUser.lastName}` : '—'} · {formatDistanceToNow(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={`text-sm ${i < r.rating ? 'text-amber-400' : 'text-[var(--border)]'}`}>★</span>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{r.comment}</p>

                <div className="flex items-center justify-between">
                  {statusPill(r.moderationStatus)}
                  <div className="flex gap-2">
                    {r.moderationStatus !== 'approved' && (
                      <button onClick={() => act(r._id, 'approved')} className="flex items-center gap-1 text-xs text-emerald-500 hover:opacity-80 font-medium">
                        <CheckCircle size={13} /> Approve
                      </button>
                    )}
                    {r.moderationStatus !== 'rejected' && (
                      <button onClick={() => act(r._id, 'rejected')} className="flex items-center gap-1 text-xs text-red-500 hover:opacity-80 font-medium">
                        <XCircle size={13} /> Reject
                      </button>
                    )}
                    {r.moderationStatus === 'approved' && (
                      <button
                        onClick={() => promote.mutate(r._id, { onSuccess: () => toast.success('Promoted to testimonial'), onError: () => toast.error('Failed') })}
                        className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 font-medium"
                      >
                        <Award size={13} /> Promote
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Testimonials Tab ─────────────────────────────────────────────────────────

function TestimonialsTab() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState({ displayName: '', displayTitle: '', content: '', rating: '5', outcome: '', isFeatured: false, isPublished: false });

  const { data, isLoading } = useAdminTestimonials();
  const create = useCreateTestimonial();
  const update = useUpdateTestimonial();
  const del = useDeleteTestimonial();
  const testimonials = data?.data ?? [];

  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setForm({ displayName: t.displayName, displayTitle: t.displayTitle ?? '', content: t.content, rating: String(t.rating), outcome: t.outcome ?? '', isFeatured: t.isFeatured, isPublished: t.isPublished });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ displayName: '', displayTitle: '', content: '', rating: '5', outcome: '', isFeatured: false, isPublished: false });
    setShowForm(true);
  };

  const submit = () => {
    const payload = { ...form, rating: parseInt(form.rating, 10) };
    if (editing) {
      update.mutate({ id: editing._id, updates: payload }, {
        onSuccess: () => { toast.success('Updated'); setShowForm(false); },
        onError: () => toast.error('Failed'),
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => { toast.success('Testimonial created'); setShowForm(false); },
        onError: () => toast.error('Failed'),
      });
    }
  };

  const togglePublish = (t: Testimonial) =>
    update.mutate({ id: t._id, updates: { isPublished: !t.isPublished } }, {
      onSuccess: () => toast.success(t.isPublished ? 'Unpublished' : 'Published'),
      onError: () => toast.error('Failed'),
    });

  const toggleFeatured = (t: Testimonial) =>
    update.mutate({ id: t._id, updates: { isFeatured: !t.isFeatured } }, {
      onSuccess: () => toast.success(t.isFeatured ? 'Unfeatured' : 'Featured'),
      onError: () => toast.error('Failed'),
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" onClick={openNew} className="flex items-center gap-2">
          <Plus size={15} /> New Testimonial
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="grid sm:grid-cols-2 gap-4">
          {testimonials.length === 0 && <p className="col-span-2 text-center py-12 text-[var(--text-secondary)] text-sm">No testimonials yet</p>}
          {testimonials.map((t: Testimonial) => (
            <div key={t._id} className="glass-card space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[var(--accent)]/20 flex-shrink-0 flex items-center justify-center font-bold text-[var(--accent)]">
                  {t.displayName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{t.displayName}</p>
                  {t.displayTitle && <p className="text-xs text-[var(--text-secondary)]">{t.displayTitle}</p>}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {Array.from({ length: t.rating }).map((_, i) => <span key={i} className="text-amber-400 text-xs">★</span>)}
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3">"{t.content}"</p>
              {t.outcome && <p className="text-xs text-emerald-500 font-medium">🎉 {t.outcome}</p>}
              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-2">
                  {statusPill(t.isPublished ? 'active' : 'inactive')}
                  {t.isFeatured && <Badge label="featured" small />}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => togglePublish(t)} title={t.isPublished ? 'Unpublish' : 'Publish'} className={`p-1.5 rounded-lg transition-colors ${t.isPublished ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}>
                    {t.isPublished ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
                  </button>
                  <button onClick={() => toggleFeatured(t)} title={t.isFeatured ? 'Unfeature' : 'Feature'} className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                    <Star size={15} className={t.isFeatured ? 'fill-amber-400' : ''} />
                  </button>
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-[var(--accent)] hover:bg-[var(--glass)]" title="Edit"><Edit3 size={15} /></button>
                  <button onClick={() => del.mutate(t._id, { onSuccess: () => toast.success('Deleted'), onError: () => toast.error('Failed') })} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Testimonial' : 'New Testimonial'} onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Display Name *</label>
                <input value={form.displayName} onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Title / Company</label>
                <input value={form.displayTitle} onChange={(e) => setForm((p) => ({ ...p, displayTitle: e.target.value }))} placeholder="SWE @ Google" className="input-field w-full" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Testimonial Content *</label>
              <textarea value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} rows={4} className="input-field w-full resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Rating</label>
                <select value={form.rating} onChange={(e) => setForm((p) => ({ ...p, rating: e.target.value }))} className="input-field w-full">
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Outcome</label>
                <input value={form.outcome} onChange={(e) => setForm((p) => ({ ...p, outcome: e.target.value }))} placeholder="Got offer at Meta" className="input-field w-full" />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))} className="w-4 h-4 accent-[var(--accent)]" />
                Published
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((p) => ({ ...p, isFeatured: e.target.checked }))} className="w-4 h-4 accent-[var(--accent)]" />
                Featured
              </label>
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="primary" onClick={submit} loading={create.isPending || update.isPending}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────

function CampaignsTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [form, setForm] = useState({ name: '', subject: '', previewText: '', htmlBody: '', targetAudience: 'all', tags: '' });

  const { data, isLoading } = useAdminCampaigns({ status: statusFilter || undefined });
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const scheduleCampaign = useScheduleCampaign();
  const cancelCampaign = useCancelCampaign();
  const deleteCampaign = useDeleteCampaign();
  const campaigns = data?.data ?? [];

  const openNew = () => {
    setEditingId(null);
    setForm({ name: '', subject: '', previewText: '', htmlBody: '', targetAudience: 'all', tags: '' });
    setShowForm(true);
  };

  const openEdit = (c: EmailCampaign) => {
    setEditingId(c._id);
    setForm({ name: c.name, subject: c.subject, previewText: c.previewText ?? '', htmlBody: c.htmlBody, targetAudience: c.targetAudience, tags: (c.tags ?? []).join(', ') });
    setShowForm(true);
  };

  const submit = () => {
    const payload: Partial<EmailCampaign> = {
      ...form,
      targetAudience: form.targetAudience as EmailCampaign['targetAudience'],
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    if (editingId) {
      updateCampaign.mutate({ id: editingId, updates: payload }, {
        onSuccess: () => { toast.success('Campaign updated'); setShowForm(false); },
        onError: () => toast.error('Failed'),
      });
    } else {
      createCampaign.mutate(payload, {
        onSuccess: () => { toast.success('Campaign created'); setShowForm(false); },
        onError: () => toast.error('Failed'),
      });
    }
  };

  const doSchedule = () => {
    if (!schedulingId || !scheduledAt) { toast.error('Select a future date/time'); return; }
    scheduleCampaign.mutate({ id: schedulingId, scheduledAt }, {
      onSuccess: () => { toast.success('Campaign scheduled'); setSchedulingId(null); setScheduledAt(''); },
      onError: () => toast.error('Failed — must be a future date'),
    });
  };

  const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
    draft: '#94a3b8', scheduled: '#f59e0b', sending: '#3b82f6', sent: '#10b981', paused: '#f97316', cancelled: '#ef4444',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FilterRow>
          <StatusChips values={['draft', 'scheduled', 'sent', 'cancelled']} active={statusFilter} onChange={setStatusFilter} />
        </FilterRow>
        <Button variant="primary" onClick={openNew} className="flex items-center gap-2 flex-shrink-0 ml-2">
          <Plus size={15} /> New Campaign
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="space-y-3">
          {campaigns.length === 0 && <p className="text-center py-12 text-[var(--text-secondary)] text-sm">No campaigns yet</p>}
          {campaigns.map((c: EmailCampaign) => (
            <div key={c._id} className="glass-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-semibold text-sm">{c.name}</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide" style={{ background: CAMPAIGN_STATUS_COLORS[c.status] + '25', color: CAMPAIGN_STATUS_COLORS[c.status] }}>
                      {c.status}
                    </span>
                    <Badge label={c.targetAudience} small />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{c.subject}</p>
                  {c.scheduledAt && <p className="text-xs text-amber-500 mt-0.5">⏰ Scheduled: {formatDate(c.scheduledAt)}</p>}
                  {c.sentAt && <p className="text-xs text-emerald-500 mt-0.5">✓ Sent: {formatDate(c.sentAt)}</p>}
                </div>

                {/* Stats (sent campaigns) */}
                {c.status === 'sent' && c.stats.deliveredCount > 0 && (
                  <div className="hidden sm:flex gap-4 text-center text-xs flex-shrink-0">
                    {[
                      { label: 'Delivered', val: c.stats.deliveredCount },
                      { label: 'Opens', val: c.stats.openCount },
                      { label: 'Clicks', val: c.stats.clickCount },
                    ].map((s) => (
                      <div key={s.label}>
                        <p className="font-bold text-sm text-[var(--text-primary)]">{s.val.toLocaleString()}</p>
                        <p className="text-[var(--text-secondary)]">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5 flex-shrink-0">
                  {['draft', 'scheduled'].includes(c.status) && (
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-[var(--accent)] hover:bg-[var(--glass)]" title="Edit"><Edit3 size={15} /></button>
                  )}
                  {c.status === 'draft' && (
                    <button onClick={() => setSchedulingId(c._id)} className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20" title="Schedule"><Clock size={15} /></button>
                  )}
                  {c.status === 'scheduled' && (
                    <button onClick={() => cancelCampaign.mutate(c._id, { onSuccess: () => toast.success('Cancelled'), onError: () => toast.error('Failed') })} className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20" title="Cancel"><Ban size={15} /></button>
                  )}
                  {!['sending'].includes(c.status) && (
                    <button onClick={() => deleteCampaign.mutate(c._id, { onSuccess: () => toast.success('Deleted'), onError: () => toast.error('Failed') })} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete"><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign form modal */}
      {showForm && (
        <Modal title={editingId ? 'Edit Campaign' : 'New Email Campaign'} onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Campaign Name *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="input-field w-full" placeholder="Summer Promo 2025" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Email Subject *</label>
              <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} className="input-field w-full" placeholder="Land your dream job with InterviewReady" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Preview Text</label>
              <input value={form.previewText} onChange={(e) => setForm((p) => ({ ...p, previewText: e.target.value }))} className="input-field w-full" placeholder="Shown in inbox preview…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Target Audience</label>
              <select value={form.targetAudience} onChange={(e) => setForm((p) => ({ ...p, targetAudience: e.target.value }))} className="input-field w-full">
                {['all', 'users', 'interviewers', 'pro_subscribers', 'inactive_users'].map((a) => (
                  <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">HTML Body *</label>
              <textarea value={form.htmlBody} onChange={(e) => setForm((p) => ({ ...p, htmlBody: e.target.value }))} rows={5} className="input-field w-full resize-y font-mono text-xs" placeholder="<p>Hello {{firstName}}, ...</p>" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Tags (comma separated)</label>
              <input value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} className="input-field w-full" placeholder="promo, onboarding, re-engagement" />
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="primary" onClick={submit} loading={createCampaign.isPending || updateCampaign.isPending}>Save Draft</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Schedule modal */}
      {schedulingId && (
        <Modal title="Schedule Campaign" onClose={() => setSchedulingId(null)}>
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">Choose a future date and time to send this campaign.</p>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Send At</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input-field w-full" min={new Date(Date.now() + 60 * 1000).toISOString().slice(0, 16)} />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setSchedulingId(null)}>Cancel</Button>
              <Button variant="primary" onClick={doSchedule} loading={scheduleCampaign.isPending}>Schedule</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [bForm, setBForm] = useState({ title: '', message: '', type: 'system_announcement', priority: 'medium', targetAudience: 'all', actionUrl: '', actionText: '' });

  const { data, isLoading } = useAdminBroadcastNotifications();
  const sendNotif = useSendPlatformNotification();
  const broadcasts = data?.data ?? [];

  const send = () => {
    if (!bForm.title || !bForm.message) { toast.error('Title and message are required'); return; }
    sendNotif.mutate(bForm, {
      onSuccess: (res) => { toast.success(`Sent to ${res.recipientCount} users`); setShowBroadcast(false); setBForm((p) => ({ ...p, title: '', message: '' })); },
      onError: () => toast.error('Failed to send'),
    });
  };

  const PRIORITY_COLORS: Record<string, string> = { low: '#94a3b8', medium: '#60a5fa', high: '#f59e0b', urgent: '#ef4444' };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setShowBroadcast(true)} className="flex items-center gap-2">
          <Send size={15} /> Broadcast Notification
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="space-y-3">
          {broadcasts.length === 0 && <p className="text-center py-12 text-[var(--text-secondary)] text-sm">No broadcasts sent yet</p>}
          {broadcasts.map((b: BroadcastNotification, i) => (
            <div key={i} className="glass-card flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-[var(--accent)]/10 flex-shrink-0"><Bell className="w-4 h-4 text-[var(--accent)]" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-semibold text-sm">{b.doc.title}</p>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: PRIORITY_COLORS[b.doc.priority] + '25', color: PRIORITY_COLORS[b.doc.priority] }}>
                    {b.doc.priority}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{b.doc.message}</p>
                <div className="flex gap-4 mt-2 text-xs text-[var(--text-secondary)]">
                  <span>📨 {b.recipients.toLocaleString()} recipients</span>
                  <span>👁 {b.readCount.toLocaleString()} read ({b.recipients > 0 ? Math.round((b.readCount / b.recipients) * 100) : 0}%)</span>
                  <span>{formatDistanceToNow(b.doc.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showBroadcast && (
        <Modal title="Broadcast Platform Notification" onClose={() => setShowBroadcast(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Title *</label>
              <input value={bForm.title} onChange={(e) => setBForm((p) => ({ ...p, title: e.target.value }))} className="input-field w-full" placeholder="Platform maintenance window" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Message *</label>
              <textarea value={bForm.message} onChange={(e) => setBForm((p) => ({ ...p, message: e.target.value }))} rows={3} className="input-field w-full resize-none" placeholder="We'll be performing scheduled maintenance on…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Target Audience</label>
                <select value={bForm.targetAudience} onChange={(e) => setBForm((p) => ({ ...p, targetAudience: e.target.value }))} className="input-field w-full">
                  {['all', 'users', 'interviewers'].map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Priority</label>
                <select value={bForm.priority} onChange={(e) => setBForm((p) => ({ ...p, priority: e.target.value }))} className="input-field w-full">
                  {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Action URL</label>
                <input value={bForm.actionUrl} onChange={(e) => setBForm((p) => ({ ...p, actionUrl: e.target.value }))} className="input-field w-full" placeholder="/subscriptions" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Action Text</label>
                <input value={bForm.actionText} onChange={(e) => setBForm((p) => ({ ...p, actionText: e.target.value }))} className="input-field w-full" placeholder="View Plans" />
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
              ⚠️ This will create in-app notifications AND push real-time alerts to all connected users matching the selected audience.
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setShowBroadcast(false)}>Cancel</Button>
              <Button variant="primary" onClick={send} loading={sendNotif.isPending} className="flex items-center gap-2">
                <Send size={14} /> Send Now
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Root Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [tab, setTab] = useState<TabId>('overview');

  const TAB_CONTENT: Record<TabId, React.ReactNode> = {
    overview: <OverviewTab />,
    users: <UsersTab />,
    interviewers: <InterviewersTab />,
    bookings: <BookingsTab />,
    payments: <PaymentsTab />,
    subscriptions: <SubscriptionsTab />,
    reviews: <ReviewsTab />,
    testimonials: <TestimonialsTab />,
    campaigns: <CampaignsTab />,
    notifications: <NotificationsTab />,
  };

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>

          {/* Header */}
          <div className="mb-8">
            <p className="text-label mb-1">Admin</p>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Dashboard</h1>
          </div>

          {/* Tab rail — scrollable on mobile */}
          <div className="overflow-x-auto -mx-4 px-4 mb-8">
            <div className="flex gap-1 min-w-max bg-[var(--bg-secondary)] rounded-2xl p-1 border border-[var(--border)]">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                    tab === id
                      ? 'bg-white dark:bg-[#2c2c2e] shadow text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {TAB_CONTENT[tab]}
          </motion.div>

        </motion.div>
      </div>
    </main>
  );
}

// Made with Bob
