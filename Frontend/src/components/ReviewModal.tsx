import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, ThumbsUp, ThumbsDown, Send } from 'lucide-react';
import { useCreateReview } from '../hooks/useApi';
import type { Booking } from '../types';
import toast from 'react-hot-toast';
import Button from './ui/Button';

interface ReviewModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess?: () => void;
}

const aspects = [
  { key: 'expertise', label: 'Expertise' },
  { key: 'communication', label: 'Communication' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'helpfulness', label: 'Helpfulness' },
] as const;

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 ${(hovered || value) >= star ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewModal({ booking, onClose, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [aspectRatings, setAspectRatings] = useState<Record<string, number>>({});
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState(true);

  const createReview = useCreateReview();

  const interviewerName = typeof booking.interviewer === 'object'
    ? booking.interviewerName ?? 'the interviewer'
    : booking.interviewerName ?? 'the interviewer';

  const handleSubmit = async () => {
    if (!rating) { toast.error('Please select an overall rating'); return; }
    if (comment.trim().length < 10) { toast.error('Comment must be at least 10 characters'); return; }

    createReview.mutate(
      {
        bookingId: booking._id,
        rating,
        comment: comment.trim(),
        aspects: aspectRatings,
        pros: pros.split('\n').map((s) => s.trim()).filter(Boolean),
        cons: cons.split('\n').map((s) => s.trim()).filter(Boolean),
        wouldRecommend,
      },
      {
        onSuccess: () => {
          toast.success('Review submitted — thank you!');
          onSuccess?.();
          onClose();
        },
        onError: (e) => toast.error(e.message || 'Failed to submit review'),
      }
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Leave a Review</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                Share your experience with {interviewerName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[var(--glass)] transition-colors"
            >
              <X className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
          </div>

          {/* Overall Rating */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Overall Rating <span className="text-red-500">*</span>
            </label>
            <StarInput value={rating} onChange={setRating} />
            {rating > 0 && (
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
              </p>
            )}
          </div>

          {/* Aspect Ratings */}
          <div className="mb-6 space-y-3">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Detailed Ratings (optional)
            </label>
            {aspects.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                <StarInput
                  value={aspectRatings[key] ?? 0}
                  onChange={(v) => setAspectRatings((prev) => ({ ...prev, [key]: v }))}
                />
              </div>
            ))}
          </div>

          {/* Comment */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Your Review <span className="text-red-500">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Describe your experience in detail..."
              className="input-field w-full resize-none"
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1 text-right">
              {comment.length}/1000
            </p>
          </div>

          {/* Pros / Cons */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                ✓ Pros (one per line)
              </label>
              <textarea
                value={pros}
                onChange={(e) => setPros(e.target.value)}
                rows={3}
                placeholder="Great communication..."
                className="input-field w-full resize-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                ✗ Cons (one per line)
              </label>
              <textarea
                value={cons}
                onChange={(e) => setCons(e.target.value)}
                rows={3}
                placeholder="Could be more detailed..."
                className="input-field w-full resize-none text-sm"
              />
            </div>
          </div>

          {/* Would Recommend */}
          <div className="mb-6 flex items-center gap-4">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Would you recommend?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWouldRecommend(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  wouldRecommend
                    ? 'bg-green-500/20 text-green-600 dark:text-green-400 ring-1 ring-green-500'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--glass)]'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Yes
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  !wouldRecommend
                    ? 'bg-red-500/20 text-red-600 dark:text-red-400 ring-1 ring-red-500'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--glass)]'
                }`}
              >
                <ThumbsDown className="w-3.5 h-3.5" /> No
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={createReview.isPending}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Submit Review
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Made with Bob
