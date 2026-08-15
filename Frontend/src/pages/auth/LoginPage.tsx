import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Zap, ArrowRight } from 'lucide-react';
import { useAppDispatch } from '../../store/hooks';
import { setCredentials } from '../../store/slices/authSlice';
import { useLogin } from '../../hooks/useApi';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import type { User } from '../../store/slices/authSlice';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    loginMutation.mutate(data, {
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
        toast.success('Welcome back!');
        navigate('/');
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? 'Invalid credentials. Try again.';
        toast.error(msg);
      },
    });
  };

  const loading = isSubmitting || loginMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      {/* BG */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-radial from-blue-100/50 via-transparent to-transparent dark:from-blue-900/20" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="glass-card rounded-3xl p-8 md:p-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 font-bold text-xl mb-6">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent)] flex items-center justify-center">
                <Zap size={18} className="text-white" />
              </div>
              InterviewReady
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@company.com"
                className="input-field"
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">Password</label>
                <Link to="/forgot-password" className="text-xs text-[var(--accent)] hover:underline">Forgot?</Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-field pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
              Sign in <ArrowRight size={16} />
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[var(--accent)] font-medium hover:underline">
              Create one free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
