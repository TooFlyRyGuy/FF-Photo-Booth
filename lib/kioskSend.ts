const GUEST_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidGuestEmail(value: string): boolean {
  return GUEST_EMAIL_PATTERN.test(value.trim());
}

export type SendChannel = 'sms' | 'email';

/**
 * Channels to auto-send once the photo is ready. A filled-in phone or email
 * is not enough: that channel must have been queued on its own.
 */
export function queuedSendChannels(input: {
  smsEnabled: boolean;
  emailEnabled: boolean;
  smsQueued: boolean;
  emailQueued: boolean;
  phone: string;
  email: string;
}): SendChannel[] {
  const channels: SendChannel[] = [];
  if (input.smsEnabled && input.smsQueued && input.phone.length >= 10) channels.push('sms');
  if (input.emailEnabled && input.emailQueued && isValidGuestEmail(input.email)) channels.push('email');
  return channels;
}
