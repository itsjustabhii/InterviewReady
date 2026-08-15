import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Zap, ArrowRight, CheckCircle } from 'lucide-react';
import { useAppDispatch } from '../../store/hooks';
import { setCredentials } from '../../store/slices/authSlice';
import { useSignup } from '../../hooks/useApi';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import type { User } from '../../store/slices/authSlice';

const schema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});

type FormValues = z.infer<typeof schema>;

const perks = ['14-day free trial', 'No credit card required', 'Cancel anytime'];

export default function SignupPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const signupMutation = useSignup();
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    signupMutation.mutate(
      {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      },
      {
        onSuccess: (res) => {
          const backendUser = res.user;
          const user: User = {
            id: backendUser._id,
            _id: backendUser._id,
            firstName: backendUser.firstName,
            lastName: backendUser.lastName,
            fullName: backendUser.fullName,
            name: backendUser.fullName,
            email: backendUser.email,
            avatar: backendUser.avatar ?? null,
            role: backendUser.role,
          };
          dispatch(setCredentials({
            user,
            token: res.accessToken,
            refreshToken: res.refreshToken,
          }));
          toast.success('Account created! Welcome aboard 🎉');
          navigate('/');
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? 'Registration failed. Please try again.';
          toast.error(msg);
        },
      },
    );
  };

  const loading = isSubmitting || signupMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16 pb-10">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-radial from-purple-100/50 via-transparent to-transparent dark:from-purple-900/20" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="glass-card rounded-3xl p-8 md:p-10">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 font-bold text-xl mb-6">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center">
                <Zap size={18} className="text-white" />
              </div>
              InterviewReady
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Start practicing for free today</p>

            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {perks.map((p) => (
                <span key={p} className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                  <CheckCircle size={13} className="text-emerald-500" /> {p}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">First name</label>
                <input {...register('firstName')} type="text" placeholder="Alex" className="input-field" autoComplete="given-name" />
                {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Last name</label>
                <input {...register('lastName')} type="text" placeholder="Chen" className="input-field" autoComplete="family-name" />
                {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <input {...register('email')} type="email" placeholder="you@company.com" className="input-field" autoComplete="email" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="8+ characters"
                  className="input-field pr-10"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Confirm password</label>
              <input {...register('confirm')} type="password" placeholder="••••••••" className="input-field" />
              {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm.message}</p>}
            </div>

            <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
              Create account <ArrowRight size={16} />
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--accent)] font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
