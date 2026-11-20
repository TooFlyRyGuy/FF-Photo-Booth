/**
 * Per-prompt overlay override for an event's prompt link (event_prompts.overlay_mode / overlay_url).
 * Pure helpers so the kiosk, the event loaders and saveEvent all agree on the same rules.
 */

export type PromptOverlayMode = 'event' | 'custom' | 'none';

export const PROMPT_OVERLAY_MODES: PromptOverlayMode[] = ['event', 'custom', 'none'];

export interface OverlayEventLike {
  overlayImageUrl?: string | null;
}

export interface OverlayPromptLike {
  id?: string;
  eventOverlayMode?: PromptOverlayMode | string | null;
  eventOverlayUrl?: string | null;
}

export const normalizeOverlayMode = (mode: unknown): PromptOverlayMode =>
  mode === 'custom' || mode === 'none' ? mode : 'event';

const cleanUrl = (url: unknown): string | null =>
  typeof url === 'string' && url.trim() !== '' ? url : null;

/**
 * Which overlay to composite on a generated image for this prompt.
 * - sticker mode: never an overlay (stickers stay transparent)
 * - 'none': no overlay
 * - 'custom' with an image: the prompt's own overlay
 * - otherwise ('event', or 'custom' with no image yet): the event overlay
 */
export const resolveOverlayForPrompt = (
  event: OverlayEventLike | null | undefined,
  eventPrompt: OverlayPromptLike | null | undefined,
  isStickerMode = false
): string | null => {
  if (isStickerMode) return null;
  const mode = normalizeOverlayMode(eventPrompt?.eventOverlayMode);
  if (mode === 'none') return null;
  if (mode === 'custom') {
    const custom = cleanUrl(eventPrompt?.eventOverlayUrl);
    if (custom) return custom;
  }
  return cleanUrl(event?.overlayImageUrl);
};

/** Map an event_prompts row's overlay columns onto the event-scoped Prompt fields. */
export const promptOverlayFieldsFromRow = (
  row: { overlay_mode?: string | null; overlay_url?: string | null } | null | undefined
): { eventOverlayMode: PromptOverlayMode; eventOverlayUrl: string | null } => ({
  eventOverlayMode: normalizeOverlayMode(row?.overlay_mode),
  eventOverlayUrl: cleanUrl(row?.overlay_url),
});

/** Build the event_prompts rows saveEvent re-inserts, carrying each prompt's overlay choice. */
export const buildEventPromptRows = (
  eventId: string,
  prompts: OverlayPromptLike[]
): Array<{ event_id: string; prompt_id: string; display_order: number; overlay_mode: PromptOverlayMode; overlay_url: string | null }> =>
  prompts.map((prompt, index) => {
    const mode = normalizeOverlayMode(prompt.eventOverlayMode);
    return {
      event_id: eventId,
      prompt_id: prompt.id as string,
      display_order: index,
      overlay_mode: mode,
      // Only a custom choice keeps its image; switching to default/none clears it.
      overlay_url: mode === 'custom' ? cleanUrl(prompt.eventOverlayUrl) : null,
    };
  });
