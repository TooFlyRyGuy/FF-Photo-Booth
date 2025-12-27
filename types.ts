export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR'
}

export enum SubscriptionTier {
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE'
}

export interface Tenant {
  id: string;
  name: string;
  tier: SubscriptionTier;
  whiteLabel: boolean;
  brandingLogo?: string;
  primaryColor?: string;
  usage: {
    imagesUsed: number;
    imagesLimit: number;
    smsUsed: number;
    smsLimit: number;
  };
  dropboxAppKey?: string;
  dropboxAppSecret?: string;
  dropboxAccessToken?: string;
  dropboxRefreshToken?: string;
  dropboxTokenExpiresAt?: string;
  dropboxEnabled?: boolean;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  twilioEnabled?: boolean;
  geminiApiKey?: string;
  geminiEnabled?: boolean;
  geminiModel?: string;
  geminiResolution?: '1K' | '2K' | '4K';
}

export interface Prompt {
  id: string;
  name: string;
  description: string;
  previewImage: string; // The thumbnail shown in the kiosk
  referenceImage?: string; // Optional style reference image for the AI
  promptText: string;
  category: string;
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
  tenantId: string;
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