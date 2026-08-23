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
  accountLanguage?: string;
}

export interface PromptTranslation {
  id?: string;
  promptId: string;
  languageCode: string;
  name: string;
  description?: string;
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
  /** Never populated from the server — only sent when clearing the SmugMug connection */
  smugmugOauthToken?: string;
  /** Never populated from the server — only sent when clearing the SmugMug connection */
  smugmugOauthTokenSecret?: string;
  smugmugUserNickname?: string;
  smugmugConnectionStatus?: string;
  smugmugUsername?: string;
  libraryWebhookUrl?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  /** Never populated from the server — only sent when admin types a new password */
  smtpPassword?: string;
  smtpPasswordSet?: boolean;
  smtpFromEmail?: string;
  smtpFromName?: string;
  smtpEnabled?: boolean;
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
  logoPosition?: 'top-left' | 'center' | 'top-right';
  logoSize?: 'small' | 'medium' | 'large' | 'extra-large';
  startDatetime?: string;
  endDatetime?: string;
  smsMessage?: string;
  smugmugGalleryKey?: string;
  smugmugGalleryUrl?: string;
  uploadOriginalsToGallery?: boolean;
  passId?: string;
  passExpiresAt?: string;
  eventSource?: 'subscription' | 'event_pass' | 'admin';
  limitPhotosPerDevice?: boolean;
  maxPhotosPerDevice?: number;
  qrAccessEnabled?: boolean;
  galleryEnabled?: boolean;
  showAccountPromo?: boolean;
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  emailEnabled?: boolean;
  emailSubject?: string;
  emailBody?: string;
  downloadEnabled?: boolean;
  kioskLanguage?: string;
}

export interface EventAccessCode {
  id: string;
  eventId: string;
  token: string;
  isUsed: boolean;
  redeemedAt?: string | null;
  redeemedIp?: string | null;
  redeemedDeviceToken?: string | null;
  createdAt: string;
  batchId?: string;
}

export interface AccessCodeRedemptionResult {
  status: 'success' | 'already_used' | 'invalid' | 'disabled';
  passcode?: string;
  eventName?: string;
  message?: string;
}

export interface DeviceUsageEntry {
  id: string;
  deviceId: string;
  deviceToken: string;
  ipAddress: string | null;
  photoCount: number;
  lastInteractionAt: string;
  createdAt: string;
}

export interface DeviceLimitCheckResult {
  allowed: boolean;
  limitEnabled: boolean;
  photoCount: number;
  maxPhotos: number;
  remaining: number | null;
}

export interface GeneratedImage {
  id: string;
  url: string;
  originalUrl: string;
  promptName: string;
  createdAt: string;
  status: 'processing' | 'completed' | 'failed';
}