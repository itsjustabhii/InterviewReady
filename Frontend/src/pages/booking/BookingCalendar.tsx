import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Calendar, ArrowRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectDate, selectSlot } from '../../store/slices/bookingSlice';
import { useInterviewer, useAvailableSlots } from '../../hooks/useApi';
import { Spinner } from '../../components/ui/Loader';
import clsx from 'clsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function padded(n: number) {
  return String(n).padStart(2, '0');
}

export default function BookingCalendarPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selectedInterviewerId, selectedDate, selectedSlot } = useAppSelector((s) => s.booking);
  const today = new Date();
  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() });

  // ── Fetch interviewer from real API ─────────────────────────────────────────
  const { data: interviewerData } = useInterviewer(selectedInterviewerId ?? '');
  // interviewerData is the unwrapped interviewer object
  const interviewer = interviewerData as any;

  // ── Fetch available slots for selected date ──────────────────────────────────
  const { data: slotsData, isLoading: slotsLoading } = useAvailableSlots(
    selectedInterviewerId ?? '',
    selectedDate ?? '',
  );
  // slotsData is the unwrapped { slots, count } or array; normalize
  const slots: { _id: string; startTime: string; endTime: string; isAvailable: boolean; status: string }[] =
    useMemo(() => {
      if (!slotsData) return [];
      // useAvailableSlots returns the raw slots array from data.data.slots
      return (slotsData as any) ?? [];
    }, [slotsData]);

  const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month);
  const firstDay = getFirstDayOfMonth(viewDate.year, viewDate.month);

  const prevMonth = () => {
    setViewDate((d) => {
      if (d.month === 0) return { year: d.year - 1, month: 11 };
      return { ...d, month: d.month - 1 };
    });
  };

  const nextMonth = () => {
    setViewDate((d) => {
      if (d.month === 11) return { year: d.year + 1, month: 0 };
      return { ...d, month: d.month + 1 };
    });
  };

  const handleDateSelect = (day: number) => {
    const date = new Date(viewDate.year, viewDate.month, day);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (date < todayMidnight) return;
    const iso = `${viewDate.year}-${padded(viewDate.month + 1)}-${padded(day)}`;
    dispatch(selectDate(iso));
  };

  const handleSlotSelect = (slotId: string) => {
    dispatch(selectSlot(slotId));
  };

  const handleContinue = () => navigate('/checkout');

  const isPast = (day: number) => {
    const date = new Date(viewDate.year, viewDate.month, day);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    return date < todayMidnight;
  };

  // Format a slot's startTime (HH:mm or full ISO) to a display string
  const formatSlotTime = (startTime: string) => {
    if (!startTime) return '';
    // If it looks like HH:mm
    if (/^\d{2}:\d{2}$/.test(startTime)) {
      const [h, m] = startTime.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${padded(m)} ${ampm}`;
    }
    // If it's a full ISO or datetime string
    return new Date(startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const interviewerName = interviewer
    ? (interviewer.user
        ? `${interviewer.user.firstName} ${interviewer.user.lastName}`
        : interviewer.name ?? 'Interviewer')
    : (selectedInterviewerId ? 'Loading…' : 'Interviewer');

  const interviewerTitle = interviewer
    ? `${interviewer.position ?? interviewer.title ?? ''} at ${interviewer.company ?? ''}`
    : '';

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-label mb-2">Book a session</p>
          <h1 className="heading-section mb-2">Choose a date &amp; time</h1>
          <p className="text-[var(--text-secondary)] mb-8">
            Scheduling with <strong className="text-[var(--text-primary)]">{interviewerName}</strong>
            {interviewerTitle ? ` — ${interviewerTitle}` : ''}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-3">
            <div className="glass-card">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-6">
                <button onClick={prevMonth} className="btn-ghost w-9 h-9 p-0 rounded-full">
                  <ChevronLeft size={18} />
                </button>
                <h2 className="font-semibold text-base">
                  {MONTHS[viewDate.month]} {viewDate.year}
                </h2>
                <button onClick={nextMonth} className="btn-ghost w-9 h-9 p-0 rounded-full">
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-[var(--text-secondary)] py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const iso = `${viewDate.year}-${padded(viewDate.month + 1)}-${padded(day)}`;
                  const isSelected = iso === selectedDate;
                  const past = isPast(day);
                  const isToday =
                    day === today.getDate() &&
                    viewDate.month === today.getMonth() &&
                    viewDate.year === today.getFullYear();

                  return (
                    <button
                      key={day}
                      onClick={() => !past && handleDateSelect(day)}
                      className={clsx(
                        'aspect-square flex items-center justify-center rounded-full text-sm font-medium transition-all',
                        past && 'opacity-30 cursor-not-allowed',
                        !past && !isSelected && 'hover:bg-[var(--bg-secondary)] cursor-pointer',
                        isSelected && 'bg-[var(--accent)] text-white',
                        isToday && !isSelected && 'border border-[var(--accent)] text-[var(--accent)]'
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
                  <Calendar size={13} className="inline mr-1" />
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          {/* Time slots */}
          <div className="lg:col-span-2">
            <div className="glass-card h-full">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock size={16} className="text-[var(--accent)]" />
                Available Times
              </h3>

              {!selectedDate ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                  👆 Select a date first
                </p>
              ) : slotsLoading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                  No available slots on this day. Try another date.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((slot) => {
                    const unavailable = !slot.isAvailable || slot.status !== 'available';
                    const selected = slot._id === selectedSlot;
                    return (
                      <button
                        key={slot._id}
                        disabled={unavailable}
                        onClick={() => handleSlotSelect(slot._id)}
                        className={clsx(
                          'py-2.5 rounded-xl text-sm font-medium border transition-all',
                          unavailable && 'opacity-30 cursor-not-allowed border-[var(--border)] text-[var(--text-secondary)] line-through',
                          !unavailable && !selected && 'border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                          selected && 'bg-[var(--accent)] border-[var(--accent)] text-white'
                        )}
                      >
                        {formatSlotTime(slot.startTime)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Continue button */}
        {selectedDate && selectedSlot && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 glass-card flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold">
                {interviewerName} · {formatSlotTime(slots.find((s) => s._id === selectedSlot)?.startTime ?? '')}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · 60 min
                {interviewer ? ` · $${interviewer.hourlyRate ?? interviewer.price ?? ''}` : ''}
              </p>
            </div>
            <button onClick={handleContinue} className="btn-primary gap-2 whitespace-nowrap">
              Continue to payment <ArrowRight size={16} />
            </button>
          </motion.div>
        )}
      </div>
    </main>
  );
}
