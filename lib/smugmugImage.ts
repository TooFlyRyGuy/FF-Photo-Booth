const IMAGE_KEY = /\/(i-[A-Za-z0-9]+)\/?$/;

/** Public JPEG used when an event has no photo to attach to a test email. */
export const SAMPLE_EMAIL_IMAGE_URL =
  'https://photos.smugmug.com/photos/i-L4HLXnh/0/XL/i-L4HLXnh-XL.jpg';

export function eventPhotoEmailImageUrl(
  photo: { smugmug_url?: string | null; public_url?: string | null } | null | undefined,
): string {
  const raw = photo?.smugmug_url?.trim() || photo?.public_url?.trim() || '';
  if (!raw) return SAMPLE_EMAIL_IMAGE_URL;
  return smugmugDirectImageUrl(raw);
}

function isSmugMugHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return host === 'gallery.funframephoto.com' || host === 'smugmug.com' || host.endsWith('.smugmug.com');
}

/**
 * SmugMug gallery links that end in /i-KEY are HTML pages. Email clients need a
 * direct JPEG. Other URLs, including storage fallbacks, are returned unchanged.
 */
export function smugmugDirectImageUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (!isSmugMugHost(parsed.hostname)) return url;

  const match = parsed.pathname.match(IMAGE_KEY);
  if (!match) return url;

  const key = match[1];
  return `https://photos.smugmug.com/photos/${key}/0/XL/${key}-XL.jpg`;
}
