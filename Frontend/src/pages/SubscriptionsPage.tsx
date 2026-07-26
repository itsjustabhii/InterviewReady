import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, ArrowRight } from 'lucide-react';
import { mockPlans } from '../data/mockData';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import toast from 'react-hot-toast';

export default function SubscriptionsPage() {
  const [annual, setAnnual] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAppSelector((s) => s.auth);

  const getPrice = (price: number) => {
    if (price === 0) return '$0';
    const p = annual ? Math.round(price * 0.8) : price;
    return `$${p}`;
  };

  const handleSelect = (planId: string) => {
    if (!isAuthenticated) {
      toast('Please sign in to subscribe', { icon: '🔑' });
      navigate('/login');
      return;
    }
    if (planId === 'free') {
      toast.success('You\'re on the free plan!');
      return;
    }
    navigate('/checkout');
  };

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14"
        >
          <p className="text-label mb-3">Pricing</p>
          <h1 className="heading-section mb-4">Simple, honest pricing</h1>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
            Start free. Upgrade when you're ready. No hidden fees.
          </p>

          {/* Annual toggle */}
          <div className="inline-flex items-center gap-3 mt-8 bg-[var(--bg-secondary)] rounded-full p-1 border border-[var(--border)]">
            <button
              onClick={() => setAnnual(false)}
              className={clsx(
                'px-5 py-2 rounded-full text-sm font-medium transition-all',
                !annual ? 'bg-white dark:bg-[#2c2c2e] shadow text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={clsx(
                'px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
                annual ? 'bg-white dark:bg-[#2c2c2e] shadow text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              )}
            >
              Annual
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-semibold">
                -20%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {mockPlans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={clsx(
                'relative flex flex-col rounded-3xl p-8 border transition-all',
                plan.highlight
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]'
                  : 'border-[var(--border)] glass-card'
              )}
            >
              {plan.badge && (
                <span className={clsx(
                  'absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap',
                  plan.highlight
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                )}>
                  {plan.badge}
                </span>
              )}

              <div className="mb-6">
                <div className={clsx(
                  'w-10 h-10 rounded-2xl flex items-center justify-center mb-4',
                  plan.highlight ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                )}>
                  <Zap size={20} />
                </div>
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{getPrice(plan.price)}</span>
                  {plan.price > 0 && (
                    <span className="text-[var(--text-secondary)] text-sm">
                      / {annual ? 'mo, billed annually' : 'month'}
                    </span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check size={15} className={clsx('mt-0.5 flex-shrink-0', plan.highlight ? 'text-[var(--accent)]' : 'text-emerald-500')} />
                    <span className="text-[var(--text-secondary)]">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan.id)}
                className={clsx(
                  'w-full py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                  plan.highlight
                    ? 'bg-[var(--accent)] text-white hover:opacity-90'
                    : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)]'
                )}
              >
                {plan.price === 0 ? 'Get started free' : `Choose ${plan.name}`}
                <ArrowRight size={15} />
              </button>
            </motion.div>
          ))}
        </div>

        {/* FAQ strip */}
        <div className="mt-20 text-center">
          <p className="text-[var(--text-secondary)] text-sm">
            All plans include a 14-day money-back guarantee. Questions?{' '}
            <a href="mailto:hello@interviewready.com" className="text-[var(--accent)] hover:underline">Contact us</a>
          </p>
        </div>
      </div>
    </main>
  );
}
