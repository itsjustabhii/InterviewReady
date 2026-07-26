import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { mockInterviewers } from '../../data/mockData';
import InterviewerCard from '../../components/ui/InterviewerCard';

const EXPERTISE_OPTIONS = [
  'System Design', 'Algorithms', 'Frontend', 'Backend',
  'Machine Learning', 'Leadership', 'Behavioral', 'AWS',
];

const COMPANY_OPTIONS = ['Google', 'Meta', 'Apple', 'Amazon', 'Netflix', 'Stripe'];

const PRICE_RANGES = [
  { label: 'Under $100', min: 0, max: 99 },
  { label: '$100–$150', min: 100, max: 150 },
  { label: '$150–$200', min: 150, max: 200 },
  { label: '$200+', min: 200, max: Infinity },
];

export default function InterviewersPage() {
  const [search, setSearch] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<(typeof PRICE_RANGES)[0] | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return mockInterviewers.filter((iv) => {
      const matchSearch =
        !search ||
        iv.name.toLowerCase().includes(search.toLowerCase()) ||
        iv.company.toLowerCase().includes(search.toLowerCase()) ||
        iv.expertise.some((e) => e.toLowerCase().includes(search.toLowerCase()));
      const matchExpertise =
        selectedExpertise.length === 0 ||
        selectedExpertise.every((e) => iv.expertise.includes(e));
      const matchCompany = !selectedCompany || iv.company === selectedCompany;
      const matchPrice = !priceRange || (iv.price >= priceRange.min && iv.price <= priceRange.max);
      return matchSearch && matchExpertise && matchCompany && matchPrice;
    });
  }, [search, selectedExpertise, selectedCompany, priceRange]);

  const toggleExpertise = (tag: string) =>
    setSelectedExpertise((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const clearFilters = () => {
    setSearch('');
    setSelectedExpertise([]);
    setSelectedCompany(null);
    setPriceRange(null);
  };

  const hasFilters = search || selectedExpertise.length > 0 || selectedCompany || priceRange;

  return (
    <main className="pt-24 pb-20">
      <div className="container-xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <p className="text-label mb-2">Expert Coaches</p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <h1 className="heading-section">Find your interviewer</h1>
            <p className="text-[var(--text-secondary)] text-sm">{filtered.length} coaches available</p>
          </div>
        </motion.div>

        {/* Search + filter bar */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder="Search by name, company, or skill..."
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary gap-2 whitespace-nowrap"
          >
            <SlidersHorizontal size={16} />
            Filters
            {hasFilters && <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card mb-8 overflow-hidden"
          >
            <div className="grid md:grid-cols-3 gap-6">
              {/* Expertise */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Expertise</p>
                <div className="flex flex-wrap gap-2">
                  {EXPERTISE_OPTIONS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleExpertise(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedExpertise.includes(tag)
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Company */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Company</p>
                <div className="flex flex-wrap gap-2">
                  {COMPANY_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedCompany(selectedCompany === c ? null : c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedCompany === c
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">Price per session</p>
                <div className="flex flex-wrap gap-2">
                  {PRICE_RANGES.map((pr) => (
                    <button
                      key={pr.label}
                      onClick={() => setPriceRange(priceRange?.label === pr.label ? null : pr)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        priceRange?.label === pr.label
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-red-500 mt-5 hover:underline">
                <X size={14} /> Clear all filters
              </button>
            )}
          </motion.div>
        )}

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((iv, i) => (
              <InterviewerCard key={iv.id} interviewer={iv} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔍</p>
            <h3 className="text-xl font-semibold mb-2">No results found</h3>
            <p className="text-[var(--text-secondary)] text-sm">Try adjusting your filters</p>
            <button onClick={clearFilters} className="btn-secondary mt-4">Clear filters</button>
          </div>
        )}
      </div>
    </main>
  );
}
