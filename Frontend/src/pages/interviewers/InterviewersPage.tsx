import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import InterviewerCard from '../../components/ui/InterviewerCard';
import { Spinner } from '../../components/ui/Loader';
import { useInterviewers, useInterviewerFilterMeta } from '../../hooks/useApi';
import type { InterviewerListParams } from '../../hooks/useApi';
import type { Interviewer } from '../../types';

const SORT_OPTIONS = [
  { value: 'rating', label: 'Top Rated' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'experience', label: 'Most Experienced' },
  { value: 'sessions', label: 'Most Sessions' },
] as const;

type SortValue = typeof SORT_OPTIONS[number]['value'];

// Map API interviewer shape → InterviewerCard shape
function mapInterviewer(iv: Interviewer): Interviewer {
  const user = typeof iv.user === 'object' ? iv.user : null;
  return {
    ...iv,
    id: iv._id,
    name: user ? `${user.firstName} ${user.lastName}` : iv.name ?? 'Interviewer',
    avatar: user?.avatar ?? iv.avatar ?? '',
    title: iv.position,
    price: iv.hourlyRate,
    reviews: iv.rating.count,
    sessions: iv.completedInterviews,
    available: iv.status === 'active',
  };
}

export default function InterviewersPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortValue>('rating');
  const [minRating, setMinRating] = useState<number | undefined>();
  const [maxRate, setMaxRate] = useState<number | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  const params: InterviewerListParams = {
    page,
    limit: 12,
    search: debouncedSearch || undefined,
    expertise: selectedExpertise.length > 0 ? selectedExpertise : undefined,
    sortBy,
    minRating,
    maxRate,
  };

  const { data, isLoading, isError } = useInterviewers(params);
  const { data: meta } = useInterviewerFilterMeta();

  const interviewers = (data?.data ?? []).map(mapInterviewer);
  const pagination = data?.pagination;
  const expertiseTags = meta?.expertiseTags ?? [];

  const toggleExpertise = useCallback((tag: string) => {
    setSelectedExpertise((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setPage(1);
  }, []);

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedExpertise([]);
    setSortBy('rating');
    setMinRating(undefined);
    setMaxRate(undefined);
    setPage(1);
  };

  const hasFilters = debouncedSearch || selectedExpertise.length > 0 || minRating || maxRate;

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-10"
        >
          <p className="text-label mb-3">Our Experts</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Find Your Perfect
            <span className="text-gradient"> Interviewer</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto">
            Industry professionals from top tech companies ready to help you land your dream role.
          </p>
        </motion.div>

        {/* Search + Sort bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, company, or skill…"
              className="input-field pl-10 w-full"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortValue); setPage(1); }}
            className="input-field w-full sm:w-48"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters((p) => !p)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors font-medium text-sm ${
              showFilters
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <SlidersHorizontal size={16} />
            Filters
            {hasFilters && (
              <span className="w-2 h-2 rounded-full bg-red-400 ml-1" />
            )}
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card mb-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">Filters</h3>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-red-500 hover:opacity-80"
                >
                  <X size={12} /> Clear all
                </button>
              )}
            </div>

            {/* Expertise */}
            {expertiseTags.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Expertise</p>
                <div className="flex flex-wrap gap-2">
                  {expertiseTags.slice(0, 20).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleExpertise(tag)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        selectedExpertise.includes(tag)
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Min Rating</p>
                <select
                  value={minRating ?? ''}
                  onChange={(e) => { setMinRating(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                  className="input-field w-full text-sm"
                >
                  <option value="">Any rating</option>
                  {[3, 3.5, 4, 4.5].map((r) => (
                    <option key={r} value={r}>{r}+ stars</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Max Rate (₹/hr)</p>
                <select
                  value={maxRate ?? ''}
                  onChange={(e) => { setMaxRate(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                  className="input-field w-full text-sm"
                >
                  <option value="">Any price</option>
                  {[1000, 2000, 3000, 5000, 10000].map((p) => (
                    <option key={p} value={p}>Up to ₹{p.toLocaleString()}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}

        {/* Active filter chips */}
        {selectedExpertise.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedExpertise.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium"
              >
                {tag}
                <button onClick={() => toggleExpertise(tag)}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Results count */}
        {pagination && (
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {pagination.total} interviewer{pagination.total !== 1 ? 's' : ''} found
            {pagination.totalPages > 1 && ` · Page ${page} of ${pagination.totalPages}`}
          </p>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Spinner className="w-10 h-10" />
          </div>
        ) : isError ? (
          <div className="text-center py-24 text-[var(--text-secondary)]">
            <p className="text-lg mb-2">Failed to load interviewers</p>
            <p className="text-sm opacity-60">Please check your connection and try again.</p>
          </div>
        ) : interviewers.length === 0 ? (
          <div className="text-center py-24 text-[var(--text-secondary)]">
            <p className="text-2xl mb-2">😕</p>
            <p className="font-medium mb-1">No interviewers found</p>
            <p className="text-sm">Try adjusting your filters</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-4 text-[var(--accent)] text-sm hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
          >
            {interviewers.map((iv) => (
              <InterviewerCard key={iv._id} interviewer={iv} />
            ))}
          </motion.div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrevPage}
              className="p-2 rounded-xl border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--glass)] transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === pagination.totalPages)
              .map((p, idx, arr) => (
                <>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span key={`ellipsis-${p}`} className="px-1 text-[var(--text-secondary)]">…</span>
                  )}
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${
                      p === page
                        ? 'bg-[var(--accent)] text-white'
                        : 'border border-[var(--border)] hover:bg-[var(--glass)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {p}
                  </button>
                </>
              ))}
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={!pagination.hasNextPage}
              className="p-2 rounded-xl border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--glass)] transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

// Made with Bob
