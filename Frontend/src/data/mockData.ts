import type { Interviewer, SubscriptionPlan, Booking } from '../types';

// Helper to build a minimal mock Interviewer that satisfies the full type
function mkInterviewer(partial: {
  id: string; name: string; avatar: string; title: string; company: string;
  expertise: string[]; rating: number; reviews: number; price: number;
  currency: string; bio: string; languages: string[]; sessions: number; available: boolean;
}): Interviewer {
  return {
    _id: partial.id,
    id: partial.id,
    user: { _id: partial.id, firstName: partial.name.split(' ')[0], lastName: partial.name.split(' ')[1] ?? '', fullName: partial.name, avatar: partial.avatar, bio: partial.bio, location: '', timezone: 'UTC' },
    expertise: partial.expertise,
    experience: 5,
    company: partial.company,
    position: partial.title,
    hourlyRate: partial.price,
    currency: partial.currency,
    availability: [],
    languages: partial.languages,
    rating: { average: partial.rating, count: partial.reviews },
    totalInterviews: partial.sessions,
    completedInterviews: partial.sessions,
    completionRate: 100,
    isVerified: true,
    isApproved: true,
    status: partial.available ? 'active' : 'inactive',
    bio: partial.bio,
    interviewTypes: ['technical'],
    certifications: [],
    createdAt: new Date().toISOString(),
    // convenience aliases
    name: partial.name,
    avatar: partial.avatar,
    title: partial.title,
    price: partial.price,
    reviews: partial.reviews,
    sessions: partial.sessions,
    available: partial.available,
  };
}

// --- Mock Interviewers ---
export const mockInterviewers: Interviewer[] = [
  mkInterviewer({ id: '1', name: 'Sarah Chen', avatar: 'https://i.pravatar.cc/150?img=47', title: 'Senior Staff Engineer', company: 'Google', expertise: ['System Design', 'Algorithms', 'Leadership'], rating: 4.9, reviews: 312, price: 149, currency: 'USD', bio: 'I help engineers land roles at top-tier companies with personalized system design deep-dives and behavioral frameworks.', languages: ['English', 'Mandarin'], sessions: 870, available: true }),
  mkInterviewer({ id: '2', name: 'James Patel', avatar: 'https://i.pravatar.cc/150?img=68', title: 'Principal Engineer', company: 'Meta', expertise: ['React', 'TypeScript', 'Frontend Architecture'], rating: 4.8, reviews: 201, price: 129, currency: 'USD', bio: 'Former Meta principal. Expert in frontend interviews. I coach on performance, accessibility and real-world architecture.', languages: ['English', 'Hindi'], sessions: 640, available: true }),
  mkInterviewer({ id: '3', name: 'Mia Johansson', avatar: 'https://i.pravatar.cc/150?img=32', title: 'Engineering Manager', company: 'Stripe', expertise: ['Behavioral', 'Leadership', 'EM Interviews'], rating: 4.95, reviews: 178, price: 189, currency: 'USD', bio: 'Engineering Manager at Stripe. I specialize in coaching future EMs on leadership, culture fit, and project deep-dives.', languages: ['English', 'Swedish'], sessions: 430, available: false }),
  mkInterviewer({ id: '4', name: 'Rahul Sharma', avatar: 'https://i.pravatar.cc/150?img=12', title: 'Senior SWE', company: 'Amazon', expertise: ['AWS', 'Backend', 'Distributed Systems'], rating: 4.7, reviews: 265, price: 119, currency: 'USD', bio: 'AWS certified expert with 8 years at Amazon. Focus on backend, distributed systems, and LP-based behavioral rounds.', languages: ['English', 'Hindi', 'Telugu'], sessions: 720, available: true }),
  mkInterviewer({ id: '5', name: 'Yuki Tanaka', avatar: 'https://i.pravatar.cc/150?img=41', title: 'ML Engineer', company: 'Apple', expertise: ['Machine Learning', 'Python', 'ML Design'], rating: 4.85, reviews: 134, price: 169, currency: 'USD', bio: 'ML Engineer on the Siri team. I coach on ML system design, Python interviews, and model deployment challenges.', languages: ['English', 'Japanese'], sessions: 310, available: true }),
  mkInterviewer({ id: '6', name: 'David Kim', avatar: 'https://i.pravatar.cc/150?img=15', title: 'Staff SWE', company: 'Netflix', expertise: ['Algorithms', 'Data Structures', 'LeetCode'], rating: 4.88, reviews: 389, price: 109, currency: 'USD', bio: 'LeetCode champion and Netflix staff engineer. Guaranteed improvement in problem-solving speed and accuracy.', languages: ['English', 'Korean'], sessions: 980, available: true }),
];

// --- Mock Subscription Plans ---
export const mockPlans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Starter',
    price: 0,
    period: 'monthly',
    features: ['2 mock interviews/mo', 'Basic AI feedback', 'Community access', 'Resume review (1x)'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    period: 'monthly',
    features: [
      '10 mock interviews/mo',
      'Priority booking',
      'Advanced AI feedback',
      'Resume review (5x)',
      'Recorded sessions',
      'Expert Q&A (async)',
    ],
    highlight: true,
    badge: 'Most Popular',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    period: 'monthly',
    features: [
      'Unlimited interviews',
      'Dedicated coach',
      'Company-specific prep',
      'Offer negotiation coaching',
      'Group sessions',
      'Priority support',
    ],
    badge: 'Best Value',
  },
];

// --- Mock Bookings ---
export const mockBookings: Booking[] = [
  {
    _id: 'b1', id: 'b1', user: '1', interviewer: '1',
    interviewerName: 'Sarah Chen',
    scheduledDate: '2025-08-10', startTime: '10:00 AM', endTime: '11:00 AM',
    duration: 60, type: 'System Design',
    status: 'confirmed', price: 149, currency: 'USD', createdAt: new Date().toISOString(),
    date: '2025-08-10', slot: '10:00 AM', roomUrl: '/room/b1',
  },
  {
    _id: 'b2', id: 'b2', user: '1', interviewer: '6',
    interviewerName: 'David Kim',
    scheduledDate: '2025-08-14', startTime: '3:00 PM', endTime: '4:00 PM',
    duration: 60, type: 'Algorithms',
    status: 'pending', price: 109, currency: 'USD', createdAt: new Date().toISOString(),
    date: '2025-08-14', slot: '3:00 PM',
  },
  {
    _id: 'b3', id: 'b3', user: '1', interviewer: '2',
    interviewerName: 'James Patel',
    scheduledDate: '2025-07-28', startTime: '11:00 AM', endTime: '12:00 PM',
    duration: 60, type: 'Frontend Interview',
    status: 'completed', price: 129, currency: 'USD', createdAt: new Date().toISOString(),
    date: '2025-07-28', slot: '11:00 AM', roomUrl: '/room/b3',
  },
];
