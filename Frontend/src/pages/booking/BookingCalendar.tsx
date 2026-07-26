import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Calendar, ArrowRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectDate, selectSlot } from '../../store/slices/bookingSlice';
import { mockInterviewers } from '../../data/mockData';
import clsx from 'clsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const TIME_SLOTS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
  '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM',
];

// Mock some unavailable slots
const UNAVAILABLE = new Set(['9:30 AM', '11:00 AM', '2:00 PM', '6:00 PM']);

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function BookingCalendarPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selectedInterviewerId, selectedDate, selectedSlot } = useAppSelector((s) => s.booking);
  const today = new Date();
  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const interviewer = mockInterviewers.find((iv) => iv.id === selectedInterviewerId) || mockInterviewers[0];

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
    if (date < new Date(today.setHours(0, 0, 0, 0))) return;
    const iso = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dispatch(selectDate(iso));
  };

  const handleSlotSelect = (slot: string) => {
    if (UNAVAILABLE.has(slot)) return;
    dispatch(selectSlot(slot));
  };

  const handleContinue = () => navigate('/checkout');

  const isPast = (day: number) => {
    const date = new Date(viewDate.year, viewDate.month, day);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    return date < todayMidnight;
  };

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-label mb-2">Book a session</p>
          <h1 className="heading-section mb-2">Choose a date & time</h1>
          <p className="text-[var(--text-secondary)] mb-8">
            Scheduling with <strong className="text-[var(--text-primary)]">{interviewer.name}</strong> — {interviewer.title} at {interviewer.company}
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
                  const iso = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
                <span className="text-xs text-[var(--text-secondary)] font-normal">(PDT)</span>
              </h3>

              {!selectedDate ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                  👆 Select a date first
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const unavailable = UNAVAILABLE.has(slot);
                    const selected = slot === selectedSlot;
                    return (
                      <button
                        key={slot}
                        disabled={unavailable}
                        onClick={() => handleSlotSelect(slot)}
                        className={clsx(
                          'py-2.5 rounded-xl text-sm font-medium border transition-all',
                          unavailable && 'opacity-30 cursor-not-allowed border-[var(--border)] text-[var(--text-secondary)] line-through',
                          !unavailable && !selected && 'border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                          selected && 'bg-[var(--accent)] border-[var(--accent)] text-white'
                        )}
                      >
                        {slot}
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
              <p className="font-semibold">{interviewer.name} · {selectedSlot}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · 60 min · ${interviewer.price}
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
