import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Lock, Camera, Check, Eye, EyeOff, Calendar, ExternalLink } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateUser } from '../../store/slices/authSlice';
import Button from '../../components/ui/Button';
import GlassCard from '../../components/ui/GlassCard';
import { Spinner } from '../../components/ui/Loader';
import Badge from '../../components/ui/Badge';
import ReviewModal from '../../components/ReviewModal';
import { useProfile, useUpdateProfile, useChangePassword, useMyBookings } from '../../hooks/useApi';
import type { Booking } from '../../types';
import { formatDate } from '../../lib/dateUtils';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const profileSchema = z.object({
  firstName: z.string().min(2, 'At least 2 characters'),
  lastName: z.string().min(2, 'At least 2 characters'),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

const TABS = ['Profile', 'Bookings', 'Security'] as const;

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const [tab, setTab] = useState<typeof TABS[number]>('Profile');
  const [showPass, setShowPass] = useState(false);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);

  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const { data: bookings = [], isLoading: bookingsLoading } = useMyBookings();

  const { register: regProfile, handleSubmit: hsProfile, formState: { errors: errProfile } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: profile?.firstName ?? authUser?.name?.split(' ')[0] ?? '',
      lastName: profile?.lastName ?? authUser?.name?.split(' ')[1] ?? '',
      bio: profile?.bio ?? '',
      location: profile?.location ?? '',
      phone: profile?.phone ?? '',
    },
  });

  const { register: regPw, handleSubmit: hsPw, reset: resetPw, formState: { errors: errPw } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const onSaveProfile = (data: ProfileForm) => {
    updateProfile.mutate(data, {
      onSuccess: (updated) => {
        dispatch(updateUser({ name: `${updated.firstName} ${updated.lastName}`, email: updated.email }));
        toast.success('Profile updated!');
      },
      onError: () => toast.error('Failed to update profile'),
    });
  };

  const onChangePassword = (data: PasswordForm) => {
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => { toast.success('Password changed!'); resetPw(); },
        onError: () => toast.error('Incorrect current password'),
      }
    );
  };

  const statusColors: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    rescheduled: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  const avatarFallback = profile
    ? `${profile.firstName[0]}${profile.lastName[0]}`
    : authUser?.name?.slice(0, 2).toUpperCase() ?? 'U';

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>

          {/* Header */}
          <div className="glass-card mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center text-2xl font-bold text-white">
                  {profile?.avatar
                    ? <img src={profile.avatar} alt="avatar" className="w-full h-full rounded-2xl object-cover" />
                    : avatarFallback
                  }
                </div>
                <button className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                  {profileLoading ? '…' : profile ? `${profile.firstName} ${profile.lastName}` : authUser?.name}
                </h1>
                <p className="text-[var(--text-secondary)] text-sm mt-1">{profile?.email ?? authUser?.email}</p>
                {profile?.location && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">📍 {profile.location}</p>
                )}
              </div>
              <div className="sm:ml-auto">
                <Badge label={profile?.role ?? authUser?.role ?? 'user'} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-[var(--bg-secondary)] rounded-2xl p-1 border border-[var(--border)]">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all',
                  tab === t
                    ? 'bg-white dark:bg-[#2c2c2e] shadow text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Profile Tab */}
          {tab === 'Profile' && (
            <GlassCard>
              <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                <User className="w-5 h-5 text-[var(--accent)]" /> Personal Information
              </h2>
              {profileLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <form onSubmit={hsProfile(onSaveProfile)} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">First Name</label>
                      <input {...regProfile('firstName')} className="input-field w-full" />
                      {errProfile.firstName && <p className="text-xs text-red-500 mt-1">{errProfile.firstName.message}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Last Name</label>
                      <input {...regProfile('lastName')} className="input-field w-full" />
                      {errProfile.lastName && <p className="text-xs text-red-500 mt-1">{errProfile.lastName.message}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </label>
                    <input
                      value={profile?.email ?? authUser?.email ?? ''}
                      disabled
                      className="input-field w-full opacity-50 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Bio</label>
                    <textarea {...regProfile('bio')} rows={3} className="input-field w-full resize-none" placeholder="Tell us about yourself…" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Location</label>
                      <input {...regProfile('location')} className="input-field w-full" placeholder="City, Country" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Phone</label>
                      <input {...regProfile('phone')} className="input-field w-full" placeholder="+1 234 567 8900" />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={updateProfile.isPending}
                    className="flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Save Changes
                  </Button>
                </form>
              )}
            </GlassCard>
          )}

          {/* Bookings Tab */}
          {tab === 'Bookings' && (
            <GlassCard>
              <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[var(--accent)]" /> My Sessions
              </h2>
              {bookingsLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-secondary)]">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium mb-1">No bookings yet</p>
                  <p className="text-sm">Book a session with an expert to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking) => {
                    const ivName = typeof booking.interviewer === 'object' && booking.interviewer && typeof booking.interviewer.user === 'object'
                      ? `${booking.interviewer.user.firstName} ${booking.interviewer.user.lastName}`
                      : booking.interviewerName ?? 'Interviewer';

                    return (
                      <div key={booking._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--border)] hover:bg-[var(--glass)] transition-colors">
                        <div>
                          <p className="font-medium text-sm">{ivName}</p>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {booking.type} · {formatDate(booking.scheduledDate ?? booking.date)} · {booking.startTime ?? booking.slot}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[booking.status] ?? ''}`}>
                            {booking.status}
                          </span>
                          {booking.status === 'confirmed' && booking.roomId && (
                            <a
                              href={`/room/${booking.roomId}?bookingId=${booking._id}`}
                              className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 font-medium"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Join
                            </a>
                          )}
                          {booking.status === 'completed' && (
                            <button
                              onClick={() => setReviewBooking(booking)}
                              className="text-xs text-amber-500 hover:opacity-80 font-medium"
                            >
                              ★ Review
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          )}

          {/* Security Tab */}
          {tab === 'Security' && (
            <GlassCard>
              <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                <Lock className="w-5 h-5 text-[var(--accent)]" /> Change Password
              </h2>
              <form onSubmit={hsPw(onChangePassword)} className="space-y-4 max-w-sm">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Current Password</label>
                  <div className="relative">
                    <input
                      {...regPw('currentPassword')}
                      type={showPass ? 'text' : 'password'}
                      className="input-field w-full pr-10"
                    />
                    <button type="button" onClick={() => setShowPass((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errPw.currentPassword && <p className="text-xs text-red-500 mt-1">{errPw.currentPassword.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">New Password</label>
                  <input {...regPw('newPassword')} type="password" className="input-field w-full" />
                  {errPw.newPassword && <p className="text-xs text-red-500 mt-1">{errPw.newPassword.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Confirm New Password</label>
                  <input {...regPw('confirmPassword')} type="password" className="input-field w-full" />
                  {errPw.confirmPassword && <p className="text-xs text-red-500 mt-1">{errPw.confirmPassword.message}</p>}
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  loading={changePassword.isPending}
                >
                  Update Password
                </Button>
              </form>
            </GlassCard>
          )}
        </motion.div>
      </div>

      {/* Review Modal */}
      {reviewBooking && (
        <ReviewModal
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
        />
      )}
    </main>
  );
}

// Made with Bob
