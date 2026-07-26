export interface Interviewer {
  id: string;
  name: string;
  avatar: string;
  title: string;
  company: string;
  expertise: string[];
  rating: number;
  reviews: number;
  price: number;
  currency: string;
  bio: string;
  languages: string[];
  sessions: number;
  available: boolean;
}

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

export interface Booking {
  id: string;
  interviewerId: string;
  interviewerName: string;
  date: string;
  slot: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  type: string;
  roomUrl?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  period: 'monthly' | 'yearly';
  features: string[];
  highlight?: boolean;
  badge?: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  rating: number;
  comment: string;
  date: string;
}
