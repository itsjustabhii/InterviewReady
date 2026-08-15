import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { useSubscriptionPlans, useMySubscription, useCreateSubscriptionOrder, useVerifyPayment, useCreateSubscription } from '../hooks/useApi';
import { Spinner } from '../components/ui/Loader';
import toast from 'react-hot-toast';

declare global { interface Window { Razorpay: any } }

const PLAN_ORDER = ['basic', 'pro', 'premium'] as const;

export default function SubscriptionsPage() {
  const [annual, setAnnual] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);

  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: mySubscription } = useMySubscription();
  const createOrder = useCreateSubscriptionOrder();
  const verifyPayment = useVerifyPayment();
  const createSubscription = useCreateSubscription();

  const getPrice = (price: number) => {
    if (price === 0) return '₹0';
    const p = annual ? Math.round(price * 0.8) : price;
    return `₹${p.toLocaleString('en-IN')}`;
  };

  const handleSelect = async (planKey: string) => {
    if (!isAuthenticated) {
      toast('Please sign in to subscribe', { icon: '🔑' });
      navigate('/login');
      return;
    }

    const planDef = plans?.[planKey as keyof typeof plans];
    if (!planDef) return;

    if (planKey === 'basic' && (planDef as any).price === 0) {
      toast.success("You're on the free plan!");
      return;
    }

    if (mySubscription?.isActive && mySubscription.plan === planKey) {
      toast('You already have this plan active!', { icon: '✅' });
      return;
    }

    // Load Razorpay script if needed
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      await new Promise((res) => { script.onload = res; document.head.appendChild(script); });
    }

    setPurchasing(planKey);
    try {
      const amount = annual
        ? Math.round((planDef as any).price * 0.8 * 100)  // paise
        : (planDef as any).price * 100;

      const order = await createOrder.mutateAsync({ plan: planKey, amount, currency: 'INR' });

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: 'INR',
          order_id: order.orderId,
          name: 'InterviewReady',
          description: `${(planDef as any).name} Subscription`,
          prefill: { name: user?.name, email: user?.email },
          theme: { color: '#3b82d4' },
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              await verifyPayment.mutateAsync({
                paymentId: order.paymentId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              await createSubscription.mutateAsync({ plan: planKey, paymentId: response.razorpay_payment_id });
              toast.success(`${(planDef as any).name} plan activated! 🎉`);
              resolve();
            } catch (e) { reject(e); }
          },
          modal: { ondismiss: () => reject(new Error('cancelled')) },
        });
        rzp.open();
      });
    } catch (err: any) {
      if (err?.message !== 'cancelled') {
        toast.error(err?.response?.data?.message ?? 'Payment failed. Please try again.');
      }
    } finally {
      setPurchasing(null);
    }
  };

  // Normalise plan list for display; keep original order basic→pro→premium
  const planEntries = plans
    ? PLAN_ORDER.map((key) => ({ key, ...(plans[key] as any) })).filter(Boolean)
    : [];

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
        {plansLoading ? (
          <div className="flex justify-center py-24"><Spinner className="w-10 h-10" /></div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {planEntries.map((plan, i) => {
              const isPro = plan.key === 'pro';
              const isActive = mySubscription?.isActive && mySubscription.plan === plan.key;
              const isPurchasing = purchasing === plan.key;

              return (
                <motion.div
                  key={plan.key}
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={clsx(
                    'relative flex flex-col rounded-3xl p-8 border transition-all',
                    isPro
                      ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]'
                      : 'border-[var(--border)] glass-card'
                  )}
                >
                  {isPro && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-[var(--accent)] text-white">
                      Most Popular
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute -top-3.5 right-4 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white">
                      Active
                    </span>
                  )}

                  <div className="mb-6">
                    <div className={clsx(
                      'w-10 h-10 rounded-2xl flex items-center justify-center mb-4',
                      isPro ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                    )}>
                      <Zap size={20} />
                    </div>
                    <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{getPrice(plan.price ?? 0)}</span>
                      {(plan.price ?? 0) > 0 && (
                        <span className="text-[var(--text-secondary)] text-sm">
                          / {annual ? 'mo, billed annually' : 'month'}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {(plan.features ?? []).map((f: string) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check size={15} className={clsx('mt-0.5 flex-shrink-0', isPro ? 'text-[var(--accent)]' : 'text-emerald-500')} />
                        <span className="text-[var(--text-secondary)]">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelect(plan.key)}
                    disabled={isPurchasing || isActive}
                    className={clsx(
                      'w-full py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                      isActive && 'opacity-60 cursor-not-allowed',
                      !isActive && isPro
                        ? 'bg-[var(--accent)] text-white hover:opacity-90'
                        : !isActive && 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)]'
                    )}
                  >
                    {isPurchasing ? (
                      <Spinner className="w-4 h-4" />
                    ) : isActive ? (
                      'Current Plan'
                    ) : (plan.price ?? 0) === 0 ? (
                      'Get started free'
                    ) : (
                      `Choose ${plan.name}`
                    )}
                    {!isPurchasing && !isActive && <ArrowRight size={15} />}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

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
