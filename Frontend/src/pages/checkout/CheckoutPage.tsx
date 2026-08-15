import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Lock, Check, ArrowLeft, Shield, CreditCard } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { clearBooking } from '../../store/slices/bookingSlice';
import { useInterviewer, useHoldSlot, useConfirmBooking, useVerifyPayment } from '../../hooks/useApi';
import Button from '../../components/ui/Button';
import GlassCard from '../../components/ui/GlassCard';
import { Spinner } from '../../components/ui/Loader';
import toast from 'react-hot-toast';

// Extend Window to include Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

/** Load the Razorpay checkout.js script once. */
function useRazorpayScript() {
  const [ready, setReady] = useState(!!window.Razorpay);
  useEffect(() => {
    if (window.Razorpay) { setReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);
  return ready;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { selectedInterviewerId, selectedDate, selectedSlot } = useAppSelector((s) => s.booking);
  const { user } = useAppSelector((s) => s.auth);
  const razorpayReady = useRazorpayScript();

  const [loading, setLoading] = useState(false);

  // ── Fetch interviewer from real API ─────────────────────────────────────────
  const { data: rawInterviewer, isLoading: ivLoading } = useInterviewer(selectedInterviewerId ?? '');
  const raw = (rawInterviewer as any)?.interviewer ?? rawInterviewer;

  const holdSlot = useHoldSlot();
  const confirmBooking = useConfirmBooking();
  const verifyPayment = useVerifyPayment();

  const interviewer = raw
    ? {
        name: raw.user ? `${raw.user.firstName} ${raw.user.lastName}` : raw.name ?? 'Interviewer',
        avatar: raw.user?.avatar ?? raw.avatar ?? '',
        title: raw.position ?? raw.title ?? '',
        company: raw.company ?? '',
        price: raw.hourlyRate ?? raw.price ?? 0,
        currency: raw.currency ?? 'INR',
      }
    : null;

  const handlePay = async () => {
    if (!selectedInterviewerId || !selectedDate || !selectedSlot) {
      toast.error('Booking details are missing. Please go back and select a slot.');
      return;
    }
    if (!razorpayReady) {
      toast.error('Payment gateway is loading. Please wait a moment.');
      return;
    }
    if (!interviewer) {
      toast.error('Interviewer details not loaded.');
      return;
    }

    setLoading(true);
    try {
      // Step 1 — Hold the slot and get back the bookingId + Razorpay order
      const holdResult = await holdSlot.mutateAsync({
        interviewerId: selectedInterviewerId,
        slotId: selectedSlot,
        date: selectedDate,
        type: 'technical',
        duration: 60,
      });

      const { holdId, orderId, paymentId, amount, currency } = holdResult as any;

      // Step 2 — Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount,         // in paise
          currency,
          order_id: orderId,
          name: 'InterviewReady',
          description: `Session with ${interviewer.name}`,
          image: interviewer.avatar,
          prefill: {
            name: user?.name,
            email: user?.email,
          },
          theme: { color: '#3b82d4' },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              // Step 3 — Verify payment and confirm booking
              await verifyPayment.mutateAsync({
                paymentId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });

              // Step 4 — Confirm the booking
              await confirmBooking.mutateAsync({ holdId });

              dispatch(clearBooking());
              toast.success('Payment successful! Your session is confirmed 🎉');
              navigate('/profile');
              resolve();
            } catch (err: any) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
        });
        rzp.open();
      });
    } catch (err: any) {
      const msg = err?.message === 'Payment cancelled'
        ? 'Payment was cancelled.'
        : err?.response?.data?.message ?? 'Payment failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (ivLoading) {
    return (
      <main className="pt-24 pb-20">
        <div className="flex justify-center py-24"><Spinner className="w-10 h-10" /></div>
      </main>
    );
  }

  const price = interviewer?.price ?? 0;

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl max-w-4xl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-8 transition-colors">
          <ArrowLeft size={15} /> Back
        </button>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Payment info */}
          <div className="lg:col-span-3">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-label mb-2">Secure Checkout</p>
              <h1 className="text-3xl font-bold mb-6">Complete booking</h1>

              <GlassCard padding="md">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <CreditCard size={18} className="text-[var(--accent)]" />
                  Payment via Razorpay
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
                  You will be redirected to Razorpay's secure payment window.
                  Your card details are never stored on our servers.
                </p>

                <Button
                  onClick={handlePay}
                  loading={loading}
                  className="w-full"
                  size="lg"
                  icon={<Lock size={16} />}
                  disabled={!interviewer || !selectedSlot}
                >
                  Pay ₹{price.toLocaleString('en-IN')}
                </Button>

                <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)] mt-4">
                  <Shield size={13} className="text-emerald-500" />
                  256-bit SSL encrypted · PCI DSS compliant via Razorpay
                </div>
              </GlassCard>
            </motion.div>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <GlassCard>
                <h3 className="font-semibold mb-5">Order summary</h3>

                {interviewer && (
                  <div className="flex gap-4 mb-6 pb-5 border-b border-[var(--border)]">
                    <img
                      src={interviewer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(interviewer.name)}&size=56`}
                      alt={interviewer.name}
                      className="w-14 h-14 rounded-2xl object-cover"
                    />
                    <div>
                      <p className="font-semibold">{interviewer.name}</p>
                      <p className="text-sm text-[var(--text-secondary)]">{interviewer.title}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{interviewer.company}</p>
                    </div>
                  </div>
                )}

                {selectedDate && selectedSlot && (
                  <div className="space-y-2 mb-5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Date</span>
                      <span>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Duration</span>
                      <span>60 minutes</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2 py-4 border-t border-[var(--border)] text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Session fee</span>
                    <span>₹{price.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Platform fee</span>
                    <span>₹0</span>
                  </div>
                </div>

                <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t border-[var(--border)]">
                  <span>Total</span>
                  <span>₹{price.toLocaleString('en-IN')}</span>
                </div>

                <div className="mt-5 space-y-2">
                  {['Free rescheduling 24h prior', 'Full refund if cancelled 48h before', 'Session recording included'].map((item) => (
                    <p key={item} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                      <Check size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </p>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}
