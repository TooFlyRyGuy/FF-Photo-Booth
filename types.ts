export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  display_name?: string | null;
  profile_picture_url?: string | null;
  bio?: string | null;
  role: UserRole;
  subscriptionStatus: string;
  subscriptionTierId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  dropbox_app_key?: string;
  dropbox_app_secret?: string;
  dropbox_access_token?: string;
  dropbox_refresh_token?: string;
  timezone?: string;
  onboardingCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserCredits {
  id: string;
  userId: string;
  images_limit: number;
  images_used: number;
  sms_limit: number;
  sms_used: number;
  events_limit: number;
  reset_date: string;
  subscription_credits: number;
  purchased_credits: number;
  event_credits: number;
  image_credits: number;
  total_credits: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  billingPeriod: 'monthly' | 'annual';
  priceCents: number;
  creditsPerPeriod: number;
  rolloverEnabled: boolean;
  features: string[];
  isActive: boolean;
  displayOrder: number;
  stripePriceId?: string;
  stripeProductId?: string;
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  stripePriceId?: string;
  stripeProductId?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface EventPass {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  credits: number;
  validityHours: number;
  stripePriceId?: string;
  stripeProductId?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface UserEventPass {
  id: string;
  userId: string;
  tierId: string;
  tierName: string;
  durationHours: number;
  purchasedAt: string;
  activatedAt?: string;
  eventId?: string;
  expiresAt?: string;
  isActive: boolean;
}

export interface UserSubscriptionType {
  subscriptionType: 'subscription' | 'event_pass' | 'free';
  tierName: string;
  hasActiveSub: boolean;
  hasAvailablePasses: boolean;
}

export interface EventTimeValidation {
  isValid: boolean;
  errorMessage?: string;
  restrictionType: string;
}

export interface ConcurrentEventLimit {
  canCreate: boolean;
  currentCount: number;
  limitCount: number;
  errorMessage?: string;
}

export interface UserSettings {
  dropboxAppKey?: string | null;
  dropboxAppSecret?: string | null;
  dropboxAccessToken?: string | null;
  dropboxRefreshToken?: string | null;
  dropboxTokenExpiresAt?: string | null;
  dropboxEnabled?: boolean;
}

export interface GlobalSettings {
  dropboxAppKey?: string;
  dropboxAppSecret?: string;
  twilioAccountSid?: string;
  /** Never populated from the server — only sent when admin types a new token */
  twilioAuthToken?: string;
  twilioTokenSet?: boolean;
  twilioPhoneNumber?: string;
  twilioEnabled?: boolean;
  /** Never populated from the server — only sent when admin types a new key */
  geminiApiKey?: string;
  geminiKeySet?: boolean;
  geminiEnabled?: boolean;
  geminiModel?: string;
  geminiResolution?: '1K' | '2K' | '4K';
  smugmugOauthToken?: string;
  smugmugOauthTokenSecret?: string;
  smugmugUserNickname?: string;
  smugmugConnectionStatus?: string;
  smugmugUsername?: string;
}

export interface Prompt {
  id: string;
  name: string;
  description: string;
  previewImage: string;
  referenceImage?: string;
  promptText: string;
  category: string;
  isPublic: boolean;
  userId?: string;
  tags?: string[];
}

export type AspectRatio = 'square' | '3:4' | '4:3' | '9:16' | '16:9';

export interface Event {
  id: string;
  name: string;
  date: string;
  city: string;
  isActive: boolean;
  passcode: string;
  prompts: Prompt[];
  userId?: string | null;
  userName?: string;
  userEmail?: string;
  createdByEmail?: string;
  aspectRatio?: AspectRatio;
  backgroundImageUrl?: string;
  logoUrl?: string;
  overlayImageUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  hideLogo?: boolean;
  hideEventName?: boolean;
  startDatetime?: string;
  endDatetime?: string;
  smsMessage?: string;
  smugmugGalleryKey?: string;
  smugmugGalleryUrl?: string;
  uploadOriginalsToGallery?: boolean;
  passId?: string;
  passExpiresAt?: string;
  eventSource?: 'subscription' | 'event_pass' | 'admin';
}

export interface GeneratedImage {
  id: string;
  url: string;
  originalUrl: string;
  promptName: string;
  createdAt: string;
  status: 'processing' | 'completed' | 'failed';
}