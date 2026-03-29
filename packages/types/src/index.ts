export type UserProfile = {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  createdAt: string;
};

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

export type Workspace = {
  id: string;
  name: string;
  ownerId: string;
  plan: SubscriptionPlan;
  createdAt: string;
};

export * from './interview-questions';
