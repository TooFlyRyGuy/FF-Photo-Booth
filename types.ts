export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
  subscriptionStatus: string;
  subscriptionTierId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
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

export interface UserSettings {
  dropboxAppKey?: string;
  dropboxAppSecret?: string;
  dropboxAccessToken?: string;
  dropboxRefreshToken?: string;
  dropboxTokenExpiresAt?: string;
  dropboxEnabled?: boolean;
}

export interface GlobalSettings {
  dropboxAppKey?: string;
  dropboxAppSecret?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  twilioEnabled?: boolean;
  geminiApiKey?: string;
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
  userId: string;
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
}

export interface GeneratedImage {
  id: string;
  url: string;
  originalUrl: string;
  promptName: string;
  createdAt: string;
  status: 'processing' | 'completed' | 'failed';
}