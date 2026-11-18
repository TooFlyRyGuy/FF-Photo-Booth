export interface KioskPromptChoice {
  mode?: string;
  customFields?: Array<{ aiGenerated?: boolean | null }> | null;
}

export type PromptFlowView = 'mode-select' | 'prompt-select' | 'prompt-customize' | 'camera';

export interface PromptFlowRoute<T extends KioskPromptChoice> {
  view: PromptFlowView;
  mode: string | null;
  prompt: T | null;
}

export function promptsForMode<T extends KioskPromptChoice>(
  prompts: readonly T[] | null | undefined,
  mode: string
): T[] {
  return (prompts || []).filter(prompt => !prompt.mode || prompt.mode === mode);
}

/** Guest-visible fields use the same rule as the style-card click handler. */
export function promptNeedsGuestInput(prompt: KioskPromptChoice | null | undefined): boolean {
  return !!prompt?.customFields?.some(field => !field.aiGenerated);
}

export function routeAfterModeSelected<T extends KioskPromptChoice>(input: {
  prompts?: readonly T[] | null;
  mode: string;
}): PromptFlowRoute<T> {
  const mode = input.mode || 'photo';
  const matches = promptsForMode(input.prompts, mode);
  if (matches.length === 1) {
    const prompt = matches[0];
    return {
      view: promptNeedsGuestInput(prompt) ? 'prompt-customize' : 'camera',
      mode,
      prompt,
    };
  }
  return { view: 'prompt-select', mode, prompt: null };
}

export function routeAfterGuestContinues<T extends KioskPromptChoice>(input: {
  prompts?: readonly T[] | null;
  enabledModes?: readonly string[] | null;
}): PromptFlowRoute<T> {
  const enabled = input.enabledModes && input.enabledModes.length > 0
    ? input.enabledModes
    : ['photo'];
  if (enabled.length > 1) {
    return { view: 'mode-select', mode: null, prompt: null };
  }
  return routeAfterModeSelected({
    prompts: input.prompts,
    mode: enabled[0] || 'photo',
  });
}

export function routeBackFromPromptStep<T extends KioskPromptChoice>(input: {
  prompts?: readonly T[] | null;
  mode: string;
  from: 'camera' | 'customize';
  enabledModes?: readonly string[] | null;
}): 'prompt-select' | 'prompt-customize' | 'attract' | 'mode-select' {
  const matches = promptsForMode(input.prompts, input.mode);
  if (matches.length !== 1) return 'prompt-select';
  if (input.from === 'camera' && promptNeedsGuestInput(matches[0])) {
    return 'prompt-customize';
  }
  const enabled = input.enabledModes && input.enabledModes.length > 0
    ? input.enabledModes
    : ['photo'];
  if (enabled.length > 1) return 'mode-select';
  return 'attract';
}
