import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Lock, Check, ArrowLeft, Shield } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { clearBooking } from '../../store/slices/bookingSlice';
import { mockInterviewers } from '../../data/mockData';
import Button from '../../components/ui/Button';
import GlassCard from '../../components/ui/GlassCard';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { selectedInterviewerId, selectedDate, selectedSlot } = useAppSelector((s) => s.booking);
  const interviewer = mockInterviewers.find((iv) => iv.id === selectedInterviewerId) || mockInterviewers[0];

  const [loading, setLoading] = useState(false);
  const [cardNum, setCardNum] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');

  const formatCardNum = (val: string) => {
    return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || cardNum.replace(/\s/g, '').length < 16 || expiry.length < 5 || cvv.length < 3) {
      toast.error('Please fill in all card details');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1800));
    dispatch(clearBooking());
    toast.success('Payment successful! Your session is confirmed 🎉');
    navigate('/bookings');
  };

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl max-w-4xl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-8 transition-colors">
          <ArrowLeft size={15} /> Back
        </button>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Payment form */}
          <div className="lg:col-span-3">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-label mb-2">Secure Checkout</p>
              <h1 className="text-3xl font-bold mb-6">Payment details</h1>

              <form onSubmit={handlePay} className="space-y-5">
                <GlassCard padding="md">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <CreditCard size={18} className="text-[var(--accent)]" />
                    Card information
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Cardholder name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        type="text"
                        placeholder="Alex Chen"
                        className="input-field"
                        autoComplete="cc-name"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Card number</label>
                      <div className="relative">
                        <input
                          value={cardNum}
                          onChange={(e) => setCardNum(formatCardNum(e.target.value))}
                          type="text"
                          inputMode="numeric"
                          placeholder="1234 5678 9012 3456"
                          className="input-field pr-10"
                          autoComplete="cc-number"
                        />
                        <CreditCard size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Expiry</label>
                        <input
                          value={expiry}
                          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                          type="text"
                          placeholder="MM/YY"
                          className="input-field"
                          autoComplete="cc-exp"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">CVV</label>
                        <input
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          type="text"
                          inputMode="numeric"
                          placeholder="•••"
                          className="input-field"
                          autoComplete="cc-csc"
                        />
                      </div>
                    </div>
                  </div>
                </GlassCard>

                <Button type="submit" loading={loading} className="w-full" size="lg" icon={<Lock size={16} />}>
                  Pay ${interviewer.price}.00
                </Button>

                <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Shield size={13} className="text-emerald-500" />
                  256-bit SSL encrypted · PCI DSS compliant
                </div>
              </form>
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

                <div className="flex gap-4 mb-6 pb-5 border-b border-[var(--border)]">
                  <img src={interviewer.avatar} alt={interviewer.name} className="w-14 h-14 rounded-2xl" />
                  <div>
                    <p className="font-semibold">{interviewer.name}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{interviewer.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{interviewer.company}</p>
                  </div>
                </div>

                {selectedDate && selectedSlot && (
                  <div className="space-y-2 mb-5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Date</span>
                      <span>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Time</span>
                      <span>{selectedSlot} (PDT)</span>
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
                    <span>${interviewer.price}.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Platform fee</span>
                    <span>$0.00</span>
                  </div>
                </div>

                <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t border-[var(--border)]">
                  <span>Total</span>
                  <span>${interviewer.price}.00</span>
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
