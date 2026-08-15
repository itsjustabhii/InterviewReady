import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import type {
  Interviewer,
  InterviewerFiltersMetaResponse,
  Review,
  Booking,
  Payment,
  RazorpayOrder,
  Subscription,
  PlanDefinition,
  Notification,
  AdminStats,
  User,
  AuthResponse,
  LoginCredentials,
  SignupCredentials,
} from '../types';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const useLogin = () =>
  useMutation<AuthResponse, Error, LoginCredentials>({
    mutationFn: async (creds) => {
      const { data } = await api.post('/v1/auth/login', creds);
      // Backend: { status, message, data: { user, tokens: { accessToken, refreshToken } } }
      const payload = data.data;
      return {
        user: payload.user,
        tokens: payload.tokens,
        accessToken: payload.tokens.accessToken,
        refreshToken: payload.tokens.refreshToken,
      };
    },
  });

export const useSignup = () =>
  useMutation<AuthResponse, Error, SignupCredentials>({
    mutationFn: async (creds) => {
      const { data } = await api.post('/v1/auth/register', creds);
      const payload = data.data;
      return {
        user: payload.user,
        tokens: payload.tokens,
        accessToken: payload.tokens.accessToken,
        refreshToken: payload.tokens.refreshToken,
      };
    },
  });

// ─── Interviewers ─────────────────────────────────────────────────────────────
export interface InterviewerListParams {
  page?: number;
  limit?: number;
  search?: string;
  expertise?: string | string[];
  minRating?: number;
  maxRate?: number;
  minRate?: number;
  experience?: number;
  language?: string;
  interviewType?: string;
  sortBy?: 'rating' | 'price_asc' | 'price_desc' | 'experience' | 'sessions';
}

export const useInterviewers = (params: InterviewerListParams = {}) =>
  useQuery({
    queryKey: ['interviewers', params],
    queryFn: async () => {
      const { data } = await api.get('/v1/interviewers', { params });
      return data as { data: Interviewer[]; pagination: import('../types').PaginationMeta };
    },
    staleTime: 1000 * 60 * 5,
  });

export const useInterviewer = (id: string) =>
  useQuery({
    queryKey: ['interviewer', id],
    queryFn: async () => {
      const { data } = await api.get(`/v1/interviewers/${id}`);
      return data.data as { interviewer: Interviewer; reviews: Review[] };
    },
    enabled: !!id,
  });

export const useInterviewerFilterMeta = () =>
  useQuery({
    queryKey: ['interviewers', 'filter-meta'],
    queryFn: async () => {
      const { data } = await api.get('/v1/interviewers/filters/meta');
      return data.data as InterviewerFiltersMetaResponse;
    },
    staleTime: 1000 * 60 * 30,
  });

export const useMyInterviewerProfile = () =>
  useQuery({
    queryKey: ['interviewer', 'me'],
    queryFn: async () => {
      const { data } = await api.get('/v1/interviewers/me');
      return data.data as Interviewer;
    },
  });

export const useUpdateInterviewer = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Interviewer>) => {
      const { data } = await api.patch(`/v1/interviewers/${id}`, updates);
      return data.data as Interviewer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interviewer', id] });
      qc.invalidateQueries({ queryKey: ['interviewer', 'me'] });
    },
  });
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const useInterviewerReviews = (interviewerId: string, params: { page?: number; limit?: number; sortBy?: string } = {}) =>
  useQuery({
    queryKey: ['reviews', 'interviewer', interviewerId, params],
    queryFn: async () => {
      const { data } = await api.get(`/v1/reviews/interviewer/${interviewerId}`, { params });
      return data as { data: Review[]; pagination: import('../types').PaginationMeta };
    },
    enabled: !!interviewerId,
  });

export const useMyReviews = () =>
  useQuery({
    queryKey: ['reviews', 'my'],
    queryFn: async () => {
      const { data } = await api.get('/v1/reviews/my');
      return data.data as Review[];
    },
  });

export const useCreateReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      bookingId: string;
      rating: number;
      comment: string;
      aspects?: Record<string, number>;
      pros?: string[];
      cons?: string[];
      wouldRecommend?: boolean;
    }) => {
      const { data } = await api.post('/v1/reviews', payload);
      return data.data as Review;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
};

// ─── Bookings ─────────────────────────────────────────────────────────────────
export const useMyBookings = () =>
  useQuery({
    queryKey: ['bookings', 'my'],
    queryFn: async () => {
      // Backend: GET /v1/bookings returns paginated list for the authenticated user
      const { data } = await api.get('/v1/bookings');
      // data.data is the array of bookings (paginated response puts items directly)
      return (Array.isArray(data.data) ? data.data : data.data) as Booking[];
    },
  });

export const useBooking = (id: string) =>
  useQuery({
    queryKey: ['booking', id],
    queryFn: async () => {
      const { data } = await api.get(`/v1/bookings/${id}`);
      return data.data as Booking;
    },
    enabled: !!id,
  });

export const useAvailableSlots = (interviewerId: string, date: string) =>
  useQuery({
    queryKey: ['slots', interviewerId, date],
    queryFn: async () => {
      // Backend: GET /v1/availability/:interviewerId?from=date&to=date
      // Returns { data: { slots: [...], count: N } }
      const { data } = await api.get(`/v1/availability/${interviewerId}`, {
        params: { from: date, to: date },
      });
      // slots array lives at data.data.slots
      const payload = data.data;
      return (payload?.slots ?? payload ?? []) as import('../types').TimeSlot[];
    },
    enabled: !!interviewerId && !!date,
    staleTime: 1000 * 60 * 2,
  });

export const useHoldSlot = () =>
  useMutation({
    mutationFn: async (payload: {
      interviewerId: string;
      slotId: string;
      date: string;
      type: string;
      duration: number;
    }) => {
      const { data } = await api.post('/v1/bookings/hold', payload);
      return data.data as { holdId: string; expiresAt: string };
    },
  });

export const useConfirmBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { holdId: string; notes?: string }) => {
      const { data } = await api.post('/v1/bookings/confirm', payload);
      return data.data as Booking;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
};

export const useCancelBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      const { data } = await api.post(`/v1/bookings/${bookingId}/cancel`, { reason });
      return data.data as Booking;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const useCreateBookingOrder = () =>
  useMutation({
    mutationFn: async (payload: { bookingId: string; amount: number; currency?: string }) => {
      const { data } = await api.post('/v1/payments/orders/booking', payload);
      return data.data as RazorpayOrder;
    },
  });

export const useCreateSubscriptionOrder = () =>
  useMutation({
    mutationFn: async (payload: { plan: string; amount: number; currency?: string }) => {
      const { data } = await api.post('/v1/payments/orders/subscription', payload);
      return data.data as RazorpayOrder;
    },
  });

export const useVerifyPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      paymentId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) => {
      const { data } = await api.post('/v1/payments/verify', payload);
      return data.data as Payment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
    },
  });
};

export const usePaymentHistory = (page = 1) =>
  useQuery({
    queryKey: ['payments', 'history', page],
    queryFn: async () => {
      const { data } = await api.get('/v1/payments/history', { params: { page } });
      return data as { data: Payment[]; pagination: import('../types').PaginationMeta };
    },
  });

// ─── Subscriptions ────────────────────────────────────────────────────────────
export const useSubscriptionPlans = () =>
  useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: async () => {
      const { data } = await api.get('/v1/subscriptions/plans');
      return data.data as Record<string, PlanDefinition>;
    },
    staleTime: 1000 * 60 * 60,
  });

export const useMySubscription = () =>
  useQuery({
    queryKey: ['subscription', 'my'],
    queryFn: async () => {
      const { data } = await api.get('/v1/subscriptions/my');
      return data.data as Subscription | null;
    },
  });

export const useCreateSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { plan: string; paymentId?: string }) => {
      const { data } = await api.post('/v1/subscriptions', payload);
      return data.data as Subscription;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription'] }),
  });
};

export const useCancelSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reason?: string) => {
      const { data } = await api.post('/v1/subscriptions/my/cancel', { reason });
      return data.data as Subscription;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription'] }),
  });
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const useNotifications = (params: { page?: number; limit?: number; unreadOnly?: boolean } = {}) =>
  useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => {
      const { data } = await api.get('/v1/notifications', { params });
      return data as {
        data: { notifications: Notification[]; unreadCount: number };
        pagination: import('../types').PaginationMeta;
      };
    },
    refetchInterval: 30_000, // poll every 30s
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/v1/notifications/unread-count');
      return (data.data as { count: number }).count;
    },
    refetchInterval: 30_000,
  });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/v1/notifications/${id}/read`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.patch('/v1/notifications/read-all');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

// ─── User Profile ─────────────────────────────────────────────────────────────
export const useProfile = () =>
  useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/v1/users/me');
      return data.data as User;
    },
  });

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<User>) => {
      const { data } = await api.patch('/v1/users/me', updates);
      return data.data as User;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
};

export const useChangePassword = () =>
  useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      await api.patch('/v1/users/me/password', payload);
    },
  });

export const useUpdatePreferences = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: Partial<User['preferences']>) => {
      const { data } = await api.patch('/v1/users/me/preferences', prefs);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const useAdminStats = () =>
  useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/stats');
      return data.data as AdminStats;
    },
    staleTime: 1000 * 60 * 2,
  });

export const useAdminUsers = (params: { page?: number; search?: string; role?: string } = {}) =>
  useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/users', { params });
      return data as { data: User[]; pagination: import('../types').PaginationMeta };
    },
  });

export const useAdminUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<User> }) => {
      const { data } = await api.patch(`/v1/admin/users/${id}`, updates);
      return data.data as User;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
};

export const useAdminInterviewers = (params: { page?: number; status?: string } = {}) =>
  useQuery({
    queryKey: ['admin', 'interviewers', params],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/interviewers', { params });
      return data as { data: Interviewer[]; pagination: import('../types').PaginationMeta };
    },
  });

export const useApproveInterviewer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/v1/admin/interviewers/${id}/approve`);
      return data.data as Interviewer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'interviewers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
};

export const useRejectInterviewer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await api.patch(`/v1/admin/interviewers/${id}/reject`, { reason });
      return data.data as Interviewer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'interviewers'] }),
  });
};

export const useAdminBookings = (params: { page?: number; status?: string } = {}) =>
  useQuery({
    queryKey: ['admin', 'bookings', params],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/bookings', { params });
      return data as { data: Booking[]; pagination: import('../types').PaginationMeta };
    },
  });

// ─── Extended Admin Hooks ─────────────────────────────────────────────────────
export const useAdminUserAnalytics = () =>
  useQuery({
    queryKey: ['admin', 'analytics', 'users'],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/analytics/users');
      return data.data as import('../types').UserAnalytics;
    },
  });

export const useSuspendInterviewer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await api.patch(`/v1/admin/interviewers/${id}/suspend`, { reason });
      return data.data as import('../types').Interviewer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'interviewers'] }),
  });
};

export const useReactivateInterviewer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/v1/admin/interviewers/${id}/reactivate`);
      return data.data as import('../types').Interviewer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'interviewers'] }),
  });
};

export const useAdminCancelBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await api.patch(`/v1/admin/bookings/${id}/cancel`, { reason });
      return data.data as import('../types').Booking;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'bookings'] }),
  });
};

export const useAdminPayments = (params: { page?: number; status?: string; dateFrom?: string; dateTo?: string } = {}) =>
  useQuery({
    queryKey: ['admin', 'payments', params],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/payments', { params });
      return data as { data: import('../types').Payment[]; pagination: import('../types').PaginationMeta };
    },
  });

export const usePaymentAnalytics = () =>
  useQuery({
    queryKey: ['admin', 'analytics', 'payments'],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/payments/analytics');
      return data.data as import('../types').PaymentAnalytics;
    },
  });

export const useAdminInitiateRefund = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, reason }: { id: string; amount?: number; reason?: string }) => {
      const { data } = await api.post(`/v1/admin/payments/${id}/refund`, { amount, reason });
      return data.data as import('../types').Payment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
};

export const useAdminSubscriptions = (params: { page?: number; status?: string; plan?: string } = {}) =>
  useQuery({
    queryKey: ['admin', 'subscriptions', params],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/subscriptions', { params });
      return data as { data: import('../types').Subscription[]; pagination: import('../types').PaginationMeta };
    },
  });

export const useSubscriptionAnalytics = () =>
  useQuery({
    queryKey: ['admin', 'analytics', 'subscriptions'],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/subscriptions/analytics');
      return data.data as import('../types').SubscriptionAnalytics;
    },
  });

export const useAdminUpdateSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const { data } = await api.patch(`/v1/admin/subscriptions/${id}/status`, { status, reason });
      return data.data as import('../types').Subscription;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'subscriptions'] }),
  });
};

export const useAdminReviews = (params: { page?: number; moderationStatus?: string } = {}) =>
  useQuery({
    queryKey: ['admin', 'reviews', params],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/reviews', { params });
      return data as { data: import('../types').Review[]; pagination: import('../types').PaginationMeta };
    },
  });

export const useAdminModerateReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/v1/admin/reviews/${id}/moderate`, { status });
      return data.data as import('../types').Review;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
  });
};

export const useAdminTestimonials = (params: { page?: number; isPublished?: boolean } = {}) =>
  useQuery({
    queryKey: ['admin', 'testimonials', params],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/testimonials', { params });
      return data as { data: import('../types').Testimonial[]; pagination: import('../types').PaginationMeta };
    },
  });

export const useCreateTestimonial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<import('../types').Testimonial>) => {
      const { data } = await api.post('/v1/admin/testimonials', payload);
      return data.data as import('../types').Testimonial;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'testimonials'] }),
  });
};

export const useUpdateTestimonial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<import('../types').Testimonial> }) => {
      const { data } = await api.patch(`/v1/admin/testimonials/${id}`, updates);
      return data.data as import('../types').Testimonial;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'testimonials'] }),
  });
};

export const useDeleteTestimonial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/v1/admin/testimonials/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'testimonials'] }),
  });
};

export const usePromoteReviewToTestimonial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { data } = await api.post(`/v1/admin/testimonials/from-review/${reviewId}`);
      return data.data as import('../types').Testimonial;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'testimonials'] }),
  });
};

export const useAdminCampaigns = (params: { page?: number; status?: string } = {}) =>
  useQuery({
    queryKey: ['admin', 'campaigns', params],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/campaigns', { params });
      return data as { data: import('../types').EmailCampaign[]; pagination: import('../types').PaginationMeta };
    },
  });

export const useCreateCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<import('../types').EmailCampaign>) => {
      const { data } = await api.post('/v1/admin/campaigns', payload);
      return data.data as import('../types').EmailCampaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
  });
};

export const useUpdateCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<import('../types').EmailCampaign> }) => {
      const { data } = await api.patch(`/v1/admin/campaigns/${id}`, updates);
      return data.data as import('../types').EmailCampaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
  });
};

export const useScheduleCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: string }) => {
      const { data } = await api.post(`/v1/admin/campaigns/${id}/schedule`, { scheduledAt });
      return data.data as import('../types').EmailCampaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
  });
};

export const useCancelCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/v1/admin/campaigns/${id}/cancel`);
      return data.data as import('../types').EmailCampaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
  });
};

export const useDeleteCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/v1/admin/campaigns/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
  });
};

export const useAdminBroadcastNotifications = (params: { page?: number } = {}) =>
  useQuery({
    queryKey: ['admin', 'broadcast-notifications', params],
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/notifications', { params });
      return data as { data: import('../types').BroadcastNotification[]; pagination: import('../types').PaginationMeta };
    },
  });

export const useSendPlatformNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      message: string;
      type?: string;
      priority?: string;
      targetAudience?: string;
      actionUrl?: string;
      actionText?: string;
    }) => {
      const { data } = await api.post('/v1/admin/notifications/broadcast', payload);
      return data.data as { recipientCount: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'broadcast-notifications'] }),
  });
};

// ─── Session / Room ───────────────────────────────────────────────────────────
export const useRoomForBooking = (bookingId: string) =>
  useQuery({
    queryKey: ['room', bookingId],
    queryFn: async () => {
      const { data } = await api.get(`/v1/sessions/room/${bookingId}`);
      return data.data as { roomId: string; iceServers: RTCIceServer[] };
    },
    enabled: !!bookingId,
  });
