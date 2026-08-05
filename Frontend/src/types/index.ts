// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  status: string;
  message: string;
  data: T;
  pagination: PaginationMeta;
}

export interface ApiSuccessResponse<T> {
  status: string;
  message: string;
  data: T;
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  avatar?: string | null;
  role: 'user' | 'interviewer' | 'admin';
  isEmailVerified: boolean;
  isActive: boolean;
  authProvider: 'local' | 'google' | 'github';
  bio?: string;
  location?: string;
  timezone: string;
  preferences: {
    notifications: { email: boolean; push: boolean; sms: boolean };
    language: string;
    theme: 'light' | 'dark' | 'system';
  };
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Interviewer ──────────────────────────────────────────────────────────────
export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

export interface AvailabilityDay {
  day: string;
  slots: { startTime: string; endTime: string; isAvailable: boolean }[];
}

export interface Interviewer {
  _id: string;
  id: string;          // virtual alias for _id used in frontend
  user: Pick<User, '_id' | 'firstName' | 'lastName' | 'fullName' | 'avatar' | 'bio' | 'location' | 'timezone'>;
  expertise: string[];
  experience: number;
  company: string;
  position: string;
  linkedIn?: string;
  github?: string;
  portfolio?: string;
  hourlyRate: number;
  currency: string;
  availability: AvailabilityDay[];
  languages: string[];
  rating: { average: number; count: number };
  totalInterviews: number;
  completedInterviews: number;
  completionRate: number;
  isVerified: boolean;
  isApproved: boolean;
  status: 'pending' | 'active' | 'inactive' | 'suspended' | 'rejected';
  bio?: string;
  interviewTypes: string[];
  certifications: {
    _id: string;
    name: string;
    issuer: string;
    issueDate: string;
    expiryDate?: string;
    url?: string;
  }[];
  earnings?: { total: number; pending: number; withdrawn: number };
  createdAt: string;
  // Convenience aliases used by legacy UI code
  name: string;
  avatar: string;
  title: string;
  price: number;
  reviews: number;
  sessions: number;
  available: boolean;
}

export interface InterviewerFiltersMetaResponse {
  expertiseTags: string[];
  languages: string[];
  interviewTypes: string[];
}

// ─── Booking ──────────────────────────────────────────────────────────────────
export interface Booking {
  _id: string;
  id: string;
  user: string | User;
  interviewer: string | Interviewer;
  interviewerName?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  duration: number;
  type: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  meetingLink?: string;
  roomId?: string;
  notes?: string;
  payment?: string;
  price: number;
  currency: string;
  createdAt: string;
  // Legacy aliases
  date: string;
  slot: string;
  roomUrl?: string;
}

// ─── Payment ──────────────────────────────────────────────────────────────────
export interface Payment {
  _id: string;
  user: string | User;
  booking?: string;
  subscription?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  paymentMethod: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paidAt?: string;
  refund?: {
    amount: number;
    reason: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    initiatedAt: string;
    processedAt?: string;
  };
  createdAt: string;
}

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  paymentId: string;
}

// ─── Subscription ─────────────────────────────────────────────────────────────
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  period: 'monthly' | 'yearly';
  features: string[];
  highlight?: boolean;
  badge?: string;
}

export interface Subscription {
  _id: string;
  user: string;
  plan: 'basic' | 'pro' | 'premium';
  planName: string;
  price: number;
  currency: string;
  duration: number;
  features: string[];
  status: 'active' | 'expired' | 'cancelled' | 'suspended' | 'pending';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  isActive: boolean;
  isExpired: boolean;
  daysRemaining: number;
  usage: { interviewsUsed: number; interviewsLimit: number };
  usagePercentage: number;
  remainingInterviews: number;
  createdAt: string;
}

export interface PlanDefinition {
  name: string;
  price: number;
  currency: string;
  duration: number;
  interviewsLimit: number;
  features: string[];
}

// ─── Review ───────────────────────────────────────────────────────────────────
export interface Review {
  _id: string;
  id: string;
  user: Pick<User, '_id' | 'firstName' | 'lastName' | 'fullName' | 'avatar'>;
  interviewer: string | Interviewer;
  booking: string;
  rating: number;
  comment: string;
  aspects?: {
    expertise?: number;
    communication?: number;
    punctuality?: number;
    helpfulness?: number;
  };
  pros?: string[];
  cons?: string[];
  wouldRecommend: boolean;
  isVerified: boolean;
  isPublished: boolean;
  helpfulCount: number;
  reportCount: number;
  response?: { comment: string; respondedAt: string };
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
  createdAt: string;
  // Legacy aliases
  userId: string;
  userName: string;
  avatar: string;
  date: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'booking_completed'
  | 'booking_rescheduled'
  | 'payment_success'
  | 'payment_failed'
  | 'payment_refunded'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'subscription_renewed'
  | 'review_received'
  | 'review_responded'
  | 'interviewer_approved'
  | 'interviewer_rejected'
  | 'withdrawal_processed'
  | 'system_announcement'
  | 'general';

export interface Notification {
  _id: string;
  user: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string;
  actionText?: string;
  createdAt: string;
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────
export interface AdminStats {
  users: { total: number; newThisMonth: number };
  interviewers: { total: number; pending: number };
  bookings: { total: number; thisMonth: number };
  revenue: { total: number; thisMonth: number };
  activeSubscriptions: number;
  pendingReviews: number;
  monthlyRevenue: Array<{ _id: { year: number; month: number }; revenue: number; count: number }>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: 'user' | 'interviewer' | 'admin';
  avatar?: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}
