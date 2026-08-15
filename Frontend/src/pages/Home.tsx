import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Users, Award, CheckCircle, Zap, TrendingUp, Shield } from 'lucide-react';
import { useInterviewers } from '../hooks/useApi';
import InterviewerCard from '../components/ui/InterviewerCard';
import GlassCard from '../components/ui/GlassCard';
import type { Interviewer } from '../types';

function mapInterviewer(iv: Interviewer): Interviewer {
  const user = typeof iv.user === 'object' ? iv.user : null;
  return {
    ...iv,
    id: iv._id,
    name: user ? `${user.firstName} ${user.lastName}` : (iv as any).name ?? 'Interviewer',
    avatar: user?.avatar ?? (iv as any).avatar ?? '',
    title: iv.position,
    price: iv.hourlyRate,
    reviews: iv.rating.count,
    sessions: iv.completedInterviews,
    available: iv.status === 'active',
  };
}

const stats = [
  { value: '12,000+', label: 'Interviews Conducted' },
  { value: '94%', label: 'Offer Rate' },
  { value: '500+', label: 'Expert Coaches' },
  { value: '4.9★', label: 'Avg. Rating' },
];

const features = [
  {
    icon: <Users size={24} />,
    title: 'Elite Interviewers',
    desc: 'Practice with engineers from Google, Meta, Apple, Amazon, Netflix, and more.',
  },
  {
    icon: <TrendingUp size={24} />,
    title: 'Personalized Feedback',
    desc: 'Get in-depth, actionable feedback tailored to the exact role you\'re targeting.',
  },
  {
    icon: <Shield size={24} />,
    title: 'Safe Environment',
    desc: 'Practice in a judgment-free zone before the real high-stakes interview.',
  },
  {
    icon: <Award size={24} />,
    title: 'Proven Results',
    desc: '94% of candidates who complete 3+ sessions receive an offer within 60 days.',
  },
];

const steps = [
  { n: '01', title: 'Choose your interviewer', desc: 'Browse 500+ experts from top companies and filter by role and expertise.' },
  { n: '02', title: 'Book a session', desc: 'Pick a time that works for you. Sessions are 45–60 minutes via video call.' },
  { n: '03', title: 'Practice & improve', desc: 'Get recorded, detailed feedback and track progress over multiple sessions.' },
];

const testimonials = [
  {
    name: 'Alex R.',
    role: 'SWE at Google',
    avatar: 'https://i.pravatar.cc/80?img=60',
    text: 'After 3 sessions with Sarah, my system design skills went from shaky to confident. Got the offer in 2 weeks.',
    rating: 5,
  },
  {
    name: 'Priya M.',
    role: 'Frontend Engineer at Meta',
    avatar: 'https://i.pravatar.cc/80?img=49',
    text: "James's feedback on React performance was eye-opening. He predicted every question in my real interview.",
    rating: 5,
  },
  {
    name: 'Jason L.',
    role: 'Engineering Manager at Stripe',
    avatar: 'https://i.pravatar.cc/80?img=57',
    text: "Mia helped me reframe my EM story completely. Stripe loved my answers. Worth every penny.",
    rating: 5,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

export default function HomePage() {
  // Load top 3 rated interviewers from the real API
  const { data } = useInterviewers({ limit: 3, sortBy: 'rating' });
  const featuredInterviewers = (data?.data ?? []).map(mapInterviewer);

  return (
    <main className="overflow-hidden">
      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center text-center pt-16">
        {/* Radial gradient background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-radial from-blue-100/60 via-transparent to-transparent dark:from-blue-900/20 dark:via-transparent" />
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-blue-200/30 dark:bg-blue-800/20 blur-3xl"
          />
        </div>

        <div className="container-xl">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-label mb-6"
          >
            #1 Interview Coaching Platform
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="heading-hero max-w-4xl mx-auto text-[var(--text-primary)] mb-6"
          >
            Land your dream tech job.{' '}
            <span className="text-[var(--accent)]">Guaranteed.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Practice 1-on-1 with engineers from Google, Meta, Apple and Netflix.
            Get personalized feedback and walk into every interview with confidence.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/interviewers" className="btn-primary text-base px-8 py-4">
              Browse Interviewers <ArrowRight size={18} />
            </Link>
            <Link to="/subscriptions" className="btn-secondary text-base px-8 py-4">
              View Pricing
            </Link>
          </motion.div>

          {/* Trust row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-[var(--text-secondary)]"
          >
            <span className="flex items-center gap-1.5"><CheckCircle size={16} className="text-emerald-500" /> No commitment</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={16} className="text-emerald-500" /> Money-back guarantee</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={16} className="text-emerald-500" /> FAANG-vetted coaches</span>
          </motion.div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="container-xl py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-bold tracking-tight">{s.value}</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section">
        <div className="container-xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-label mb-3">Why InterviewReady</p>
            <h2 className="heading-section">The smarter way to prepare</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <GlassCard hover className="h-full">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mb-4">
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Interviewers ── */}
      <section className="section bg-[var(--bg-secondary)]" id="interviewers">
        <div className="container-xl">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-label mb-2">Top Coaches</p>
              <h2 className="heading-section">Meet the experts</h2>
            </div>
            <Link to="/interviewers" className="btn-ghost hidden sm:inline-flex">
              View all <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredInterviewers.map((iv, i) => (
              <InterviewerCard key={iv._id} interviewer={iv} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="section" id="how-it-works">
        <div className="container-xl">
          <div className="text-center mb-16">
            <p className="text-label mb-3">Simple process</p>
            <h2 className="heading-section">How it works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-2xl font-bold mb-5">
                  {s.n}
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="section bg-[var(--bg-secondary)]">
        <div className="container-xl">
          <div className="text-center mb-14">
            <p className="text-label mb-3">Success stories</p>
            <h2 className="heading-section">Real results, real people</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <GlassCard className="h-full flex flex-col gap-4">
                  <div className="flex">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} size={15} className="text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed flex-1">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <img src={t.avatar} alt={t.name} className="w-9 h-9 rounded-full" />
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{t.role}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="section">
        <div className="container-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-[var(--accent)] text-white text-center py-20 px-8"
          >
            <div className="absolute inset-0 bg-gradient-radial from-white/10 via-transparent to-transparent" />
            <Zap size={48} className="mx-auto mb-6 opacity-80 animate-float" />
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
              Ready to land your offer?
            </h2>
            <p className="text-white/80 text-lg max-w-xl mx-auto mb-8">
              Join 12,000+ engineers who used InterviewReady to land roles at top companies.
            </p>
            <Link to="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[var(--accent)] font-semibold rounded-full hover:bg-gray-100 transition-colors text-base">
              Start free today <ArrowRight size={18} />
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
