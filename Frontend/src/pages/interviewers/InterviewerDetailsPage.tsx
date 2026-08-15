import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Users, Globe, ArrowLeft, Calendar, Check, BookOpen } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import StarRating from '../../components/ui/StarRating';
import Button from '../../components/ui/Button';
import GlassCard from '../../components/ui/GlassCard';
import { Spinner } from '../../components/ui/Loader';
import { useAppDispatch } from '../../store/hooks';
import { selectInterviewer } from '../../store/slices/bookingSlice';
import { useInterviewer, useInterviewerReviews } from '../../hooks/useApi';
import { formatDistanceToNow } from '../../lib/dateUtils';
import type { Interviewer, Review } from '../../types';

function mapInterviewer(iv: any): Interviewer & { name: string; avatar: string; title: string; price: number } {
  const user = iv.user ?? {};
  return {
    ...iv,
    id: iv._id,
    name: user.fullName ?? (`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || iv.name),
    avatar: user.avatar ?? iv.avatar ?? '',
    title: iv.position ?? iv.title ?? '',
    price: iv.hourlyRate ?? iv.price ?? 0,
    reviews: iv.rating?.count ?? iv.reviews ?? 0,
    sessions: iv.completedInterviews ?? iv.sessions ?? 0,
    available: iv.status === 'active',
    rating: typeof iv.rating === 'object' ? iv.rating.average : iv.rating ?? 0,
  };
}

export default function InterviewerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data: rawInterviewer, isLoading, isError } = useInterviewer(id ?? '');
  const { data: reviewsData, isLoading: reviewsLoading } = useInterviewerReviews(id ?? '', { limit: 10 });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (isError || !rawInterviewer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-4xl">🤔</p>
        <h2 className="text-xl font-semibold">Interviewer not found</h2>
        <Link to="/interviewers" className="btn-primary">Browse all</Link>
      </div>
    );
  }

  // useInterviewer returns data.data which the backend shapes as { interviewer: {...} } or directly the object
  const raw = (rawInterviewer as any)?.interviewer ?? rawInterviewer;
  const interviewer = mapInterviewer(raw);

  // Reviews: reviewsData is { data: Review[], pagination }
  const reviews: Review[] = (reviewsData as any)?.data ?? [];

  const handleBook = () => {
    dispatch(selectInterviewer(interviewer._id));
    navigate('/booking');
  };

  const ratingValue = typeof raw.rating === 'object' ? raw.rating.average : raw.rating ?? 0;

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl">
        <Link to="/interviewers" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-8 transition-colors">
          <ArrowLeft size={15} /> Back to interviewers
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile header */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card"
            >
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="relative">
                  <img
                    src={interviewer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(interviewer.name)}&size=96`}
                    alt={interviewer.name}
                    className="w-24 h-24 rounded-2xl object-cover"
                  />
                  {interviewer.available && (
                    <span className="absolute -bottom-1 -right-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-medium">
                      Available
                    </span>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h1 className="text-2xl font-bold">{interviewer.name}</h1>
                      <p className="text-[var(--text-secondary)]">
                        {interviewer.title}{interviewer.company ? ` · ${interviewer.company}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">${interviewer.price}</p>
                      <p className="text-sm text-[var(--text-secondary)]">per 60 min</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mt-4 text-sm text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      <StarRating rating={ratingValue} />
                      <strong className="text-[var(--text-primary)]">{ratingValue.toFixed(1)}</strong>
                      <span>({interviewer.reviews} reviews)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={14} />
                      {interviewer.sessions} sessions
                    </span>
                    {interviewer.languages?.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Globe size={14} />
                        {interviewer.languages.join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {(interviewer.expertise ?? []).map((tag) => (
                      <Badge key={tag} label={tag} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Bio */}
            <GlassCard>
              <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <BookOpen size={18} className="text-[var(--accent)]" />
                About
              </h2>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {raw.user?.bio ?? raw.bio ?? 'No bio provided.'}
              </p>
            </GlassCard>

            {/* Reviews */}
            <GlassCard>
              <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                <Star size={18} className="text-[var(--accent)]" />
                Reviews
                <span className="text-sm text-[var(--text-secondary)] font-normal">
                  ({reviews.length})
                </span>
              </h2>
              {reviewsLoading ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : reviews.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-6">
                  No reviews yet. Be the first!
                </p>
              ) : (
                <div className="space-y-5">
                  {reviews.map((r) => {
                    const reviewer = typeof r.user === 'object' ? r.user : null;
                    const name = reviewer
                      ? `${reviewer.firstName} ${reviewer.lastName}`
                      : (r as any).userName ?? 'Anonymous';
                    const avatar = reviewer?.avatar ?? (r as any).avatar ?? '';
                    return (
                      <div key={r._id} className="flex gap-4 pb-5 border-b border-[var(--border)] last:border-0 last:pb-0">
                        <img
                          src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=36`}
                          alt={name}
                          className="w-9 h-9 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold">{name}</p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {formatDistanceToNow(r.createdAt)}
                            </p>
                          </div>
                          <StarRating rating={r.rating} />
                          <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
                            {r.comment}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card sticky top-24"
            >
              <h3 className="font-semibold mb-4">Book a session</h3>
              <ul className="space-y-2 mb-6">
                {[
                  '60-minute live video session',
                  'Detailed written feedback',
                  'Session recording',
                  'Free rescheduling 24h prior',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <Check size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between mb-5 py-3 border-y border-[var(--border)]">
                <span className="text-sm text-[var(--text-secondary)]">Session fee</span>
                <span className="text-xl font-bold">${interviewer.price}</span>
              </div>
              <Button
                onClick={handleBook}
                className="w-full"
                size="lg"
                icon={<Calendar size={16} />}
                disabled={!interviewer.available}
              >
                {interviewer.available ? 'Book now' : 'Unavailable'}
              </Button>

              {!interviewer.available && (
                <p className="text-xs text-center text-[var(--text-secondary)] mt-2">
                  This coach is currently fully booked
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}
