import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Lock, Camera, Check, Eye, EyeOff } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateUser } from '../../store/slices/authSlice';
import Button from '../../components/ui/Button';
import GlassCard from '../../components/ui/GlassCard';
import { mockBookings } from '../../data/mockData';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const profileSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  bio: z.string().max(200).optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const TABS = ['Profile', 'Bookings', 'Security'];

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const [tab, setTab] = useState('Profile');
  const [showPass, setShowPass] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', email: user?.email || '' },
  });

  const onSaveProfile = async (data: ProfileForm) => {
    setSavingProfile(true);
    await new Promise((r) => setTimeout(r, 800));
    dispatch(updateUser({ name: data.name, email: data.email }));
    setSavingProfile(false);
    toast.success('Profile updated!');
  };

  const statusColors: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="glass-card mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                <img
                  src={user?.avatar || `https://i.pravatar.cc/150?u=${user?.id}`}
                  alt={user?.name}
                  className="w-20 h-20 rounded-2xl object-cover"
                />
                <button className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  <Camera size={18} />
                </button>
              </div>
              <div>
                <h1 className="text-2xl font-bold">{user?.name}</h1>
                <p className="text-[var(--text-secondary)]">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge label={user?.role || 'user'} />
                  {user?.plan && <Badge label={user.plan} />}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-[var(--bg-secondary)] rounded-2xl p-1">
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

          {/* Profile tab */}
          {tab === 'Profile' && (
            <GlassCard>
              <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
                <User size={18} className="text-[var(--accent)]" />
                Personal information
              </h2>
              <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Full name</label>
                    <input {...register('name')} type="text" className="input-field" />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Email</label>
                    <input {...register('email')} type="email" className="input-field" />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Bio <span className="text-[var(--text-secondary)] font-normal">(optional)</span></label>
                  <textarea {...register('bio')} rows={3} placeholder="Tell coaches a bit about yourself..." className="input-field resize-none" />
                </div>
                <Button type="submit" loading={savingProfile} icon={<Check size={15} />}>
                  Save changes
                </Button>
              </form>
            </GlassCard>
          )}

          {/* Bookings tab */}
          {tab === 'Bookings' && (
            <GlassCard>
              <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
                <Mail size={18} className="text-[var(--accent)]" />
                My sessions
              </h2>
              {mockBookings.length === 0 ? (
                <p className="text-[var(--text-secondary)] text-sm">No bookings yet.</p>
              ) : (
                <div className="space-y-3">
                  {mockBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                      <div>
                        <p className="font-medium text-sm">{b.interviewerName}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{b.type} · {b.date} · {b.slot}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', statusColors[b.status])}>
                          {b.status}
                        </span>
                        {b.roomUrl && b.status === 'confirmed' && (
                          <a href={b.roomUrl} className="btn-primary text-xs px-3 py-1.5">Join</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          )}

          {/* Security tab */}
          {tab === 'Security' && (
            <GlassCard>
              <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
                <Lock size={18} className="text-[var(--accent)]" />
                Change password
              </h2>
              <div className="space-y-4 max-w-sm">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Current password</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} placeholder="••••••••" className="input-field pr-10" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">New password</label>
                  <input type="password" placeholder="••••••••" className="input-field" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Confirm new password</label>
                  <input type="password" placeholder="••••••••" className="input-field" />
                </div>
                <Button onClick={() => toast.success('Password updated!')} icon={<Check size={15} />}>
                  Update password
                </Button>
              </div>
            </GlassCard>
          )}
        </motion.div>
      </div>
    </main>
  );
}
