import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  promptNeedsGuestInput,
  routeAfterGuestContinues,
  routeAfterModeSelected,
  routeBackFromPromptStep,
} from './kioskPromptFlow.ts';

const prompt = (
  id: string,
  mode?: 'photo' | 'sticker' | 'video',
  customFields?: Array<{ aiGenerated?: boolean | null; required?: boolean | null }>
) => ({
  id,
  mode,
  customFields,
});

const photo = (id: string, customFields?: Array<{ aiGenerated?: boolean | null; required?: boolean | null }>) =>
  prompt(id, 'photo', customFields);

const optionalGuestPrompt = photo('guest-text', [{ aiGenerated: null, required: null }]);

test('one plain prompt skips the style screen and stops on the camera', () => {
  const route = routeAfterGuestContinues({
    prompts: [photo('only')],
    enabledModes: ['photo'],
  });
  assert.equal(route.view, 'camera');
  assert.equal(route.mode, 'photo');
  assert.equal(route.prompt?.id, 'only');
  assert.equal(promptNeedsGuestInput(route.prompt), false);
  assert.equal('autoCapture' in route, false);
});

test('an optional guest field still asks for input on any event', () => {
  const route = routeAfterGuestContinues({
    prompts: [optionalGuestPrompt],
    enabledModes: ['photo'],
  });
  assert.equal(route.view, 'prompt-customize');
  assert.equal(route.prompt?.id, 'guest-text');
  assert.equal(promptNeedsGuestInput(optionalGuestPrompt), true);
});

test('a required guest field is not skipped', () => {
  const route = routeAfterGuestContinues({
    prompts: [photo('named', [{ aiGenerated: false, required: true }])],
    enabledModes: ['photo'],
  });
  assert.equal(route.view, 'prompt-customize');
});

test('ai-only fields do not count as guest input', () => {
  const route = routeAfterGuestContinues({
    prompts: [photo('ai', [{ aiGenerated: true }])],
    enabledModes: ['photo'],
  });
  assert.equal(route.view, 'camera');
});

test('a mix of ai and guest fields still asks the guest', () => {
  const route = routeAfterGuestContinues({
    prompts: [photo('mix', [{ aiGenerated: true }, { aiGenerated: false }])],
    enabledModes: ['photo'],
  });
  assert.equal(route.view, 'prompt-customize');
});

test('zero prompts stay on the style screen', () => {
  for (const prompts of [undefined, null, []]) {
    const route = routeAfterGuestContinues({ prompts, enabledModes: ['photo'] });
    assert.equal(route.view, 'prompt-select');
    assert.equal(route.prompt, null);
    assert.equal(route.mode, 'photo');
  }
});

test('multiple prompts stay on the style screen', () => {
  const route = routeAfterGuestContinues({
    prompts: [photo('a'), photo('b')],
    enabledModes: ['photo'],
  });
  assert.equal(route.view, 'prompt-select');
  assert.equal(route.prompt, null);
});

test('a prompt for another mode does not auto-select into photo', () => {
  const route = routeAfterGuestContinues({
    prompts: [{ id: 'sticker-only', mode: 'sticker' }],
    enabledModes: ['photo'],
  });
  assert.equal(route.view, 'prompt-select');
  assert.equal(route.prompt, null);
});

test('one matching prompt auto-selects when another mode is also linked', () => {
  const route = routeAfterGuestContinues({
    prompts: [photo('photo-only'), { id: 'sticker-only', mode: 'sticker' }],
    enabledModes: ['photo'],
  });
  assert.equal(route.view, 'camera');
  assert.equal(route.prompt?.id, 'photo-only');
});

test('a prompt with no mode matches the active mode', () => {
  const route = routeAfterModeSelected({
    prompts: [{ id: 'unspecified' }],
    mode: 'photo',
  });
  assert.equal(route.view, 'camera');
  assert.equal(route.prompt?.id, 'unspecified');
});

test('photo and sticker together keep the mode screen even with one prompt overall', () => {
  const route = routeAfterGuestContinues({
    prompts: [photo('only')],
    enabledModes: ['photo', 'sticker'],
  });
  assert.equal(route.view, 'mode-select');
  assert.equal(route.prompt, null);
  assert.equal(route.mode, null);
});

test('a sticker-only event auto-selects its single sticker prompt', () => {
  const plain = routeAfterGuestContinues({
    prompts: [prompt('die-cut', 'sticker')],
    enabledModes: ['sticker'],
  });
  assert.equal(plain.view, 'camera');
  assert.equal(plain.mode, 'sticker');
  assert.equal(plain.prompt?.id, 'die-cut');

  const named = routeAfterGuestContinues({
    prompts: [prompt('named-sticker', 'sticker', [{ aiGenerated: false, required: true }])],
    enabledModes: ['sticker'],
  });
  assert.equal(named.view, 'prompt-customize');
  assert.equal(named.prompt?.id, 'named-sticker');
});

test('each selected mode skips prompt selection only for its own single prompt', () => {
  const prompts = [
    photo('portrait'),
    prompt('cutout', 'sticker'),
  ];
  assert.equal(routeAfterGuestContinues({
    prompts,
    enabledModes: ['photo', 'sticker'],
  }).view, 'mode-select');

  const photoRoute = routeAfterModeSelected({ prompts, mode: 'photo' });
  assert.equal(photoRoute.view, 'camera');
  assert.equal(photoRoute.prompt?.id, 'portrait');

  const stickerRoute = routeAfterModeSelected({ prompts, mode: 'sticker' });
  assert.equal(stickerRoute.view, 'camera');
  assert.equal(stickerRoute.prompt?.id, 'cutout');
});

test('a mode with several prompts still shows them after the mode screen', () => {
  const prompts = [photo('a'), photo('b'), prompt('only-sticker', 'sticker')];
  assert.equal(routeAfterGuestContinues({
    prompts,
    enabledModes: ['photo', 'sticker'],
  }).view, 'mode-select');
  assert.equal(routeAfterModeSelected({ prompts, mode: 'photo' }).view, 'prompt-select');
  assert.equal(routeAfterModeSelected({ prompts, mode: 'sticker' }).view, 'camera');
});

test('video stored beside photo does not skip the mode screen or enter video', () => {
  const route = routeAfterGuestContinues({
    prompts: [photo('only')],
    enabledModes: ['photo', 'video'],
  });
  assert.equal(route.view, 'mode-select');
  assert.equal(route.mode, null);
  assert.notEqual(route.view, 'camera');
});

test('choosing a mode then auto-selects its only prompt', () => {
  const prompts = [
    photo('photo-only'),
    { id: 'sticker-named', mode: 'sticker', customFields: [{ aiGenerated: false, required: true }] },
  ];
  const photoRoute = routeAfterModeSelected({ prompts, mode: 'photo' });
  assert.equal(photoRoute.view, 'camera');
  assert.equal(photoRoute.prompt?.id, 'photo-only');

  const stickerRoute = routeAfterModeSelected({ prompts, mode: 'sticker' });
  assert.equal(stickerRoute.view, 'prompt-customize');
  assert.equal(stickerRoute.prompt?.id, 'sticker-named');
});

test('choosing a mode with several prompts keeps the style screen', () => {
  const route = routeAfterModeSelected({
    prompts: [photo('a'), photo('b')],
    mode: 'photo',
  });
  assert.equal(route.view, 'prompt-select');
  assert.equal(route.prompt, null);
});

test('missing enabled modes default to photo', () => {
  const route = routeAfterGuestContinues({ prompts: [photo('only')], enabledModes: [] });
  assert.equal(route.view, 'camera');
  assert.equal(route.mode, 'photo');
});

test('prompts that arrive after an empty load are used when the guest continues', () => {
  let prompts: ReturnType<typeof photo>[] = [];
  const beforeLoad = routeAfterGuestContinues({ prompts, enabledModes: ['photo'] });
  assert.equal(beforeLoad.view, 'prompt-select');

  prompts = [photo('loaded-later')];
  const afterLoad = routeAfterGuestContinues({ prompts, enabledModes: ['photo'] });
  assert.equal(afterLoad.view, 'camera');
  assert.equal(afterLoad.prompt?.id, 'loaded-later');
});

test('start over asks again with the current list and does not keep the previous choice', () => {
  const first = routeAfterGuestContinues({
    prompts: [optionalGuestPrompt],
    enabledModes: ['photo'],
  });
  assert.equal(first.view, 'prompt-customize');

  const nextGuest = routeAfterGuestContinues({
    prompts: [photo('replacement')],
    enabledModes: ['sticker'],
  });
  assert.equal(nextGuest.view, 'prompt-select');
  assert.equal(nextGuest.prompt, null);

  const stickerGuest = routeAfterGuestContinues({
    prompts: [prompt('replacement', 'sticker')],
    enabledModes: ['sticker'],
  });
  assert.equal(stickerGuest.view, 'camera');
  assert.equal(stickerGuest.prompt?.id, 'replacement');
  assert.notEqual(stickerGuest.prompt, first.prompt);
});

test('back from a skipped style screen does not reopen it', () => {
  assert.equal(routeBackFromPromptStep({
    prompts: [photo('only')],
    mode: 'photo',
    enabledModes: ['photo'],
    from: 'camera',
  }), 'attract');

  assert.equal(routeBackFromPromptStep({
    prompts: [optionalGuestPrompt],
    mode: 'photo',
    enabledModes: ['photo'],
    from: 'camera',
  }), 'prompt-customize');

  assert.equal(routeBackFromPromptStep({
    prompts: [optionalGuestPrompt],
    mode: 'photo',
    enabledModes: ['photo'],
    from: 'customize',
  }), 'attract');
});

test('back keeps the mode screen when more than one mode is enabled', () => {
  const prompts = [photo('portrait'), prompt('cutout', 'sticker')];
  assert.equal(routeBackFromPromptStep({
    prompts,
    mode: 'photo',
    enabledModes: ['photo', 'sticker'],
    from: 'camera',
  }), 'mode-select');

  assert.equal(routeBackFromPromptStep({
    prompts: [prompt('named', 'sticker', [{ aiGenerated: false }])],
    mode: 'sticker',
    enabledModes: ['photo', 'sticker'],
    from: 'camera',
  }), 'prompt-customize');

  assert.equal(routeBackFromPromptStep({
    prompts: [prompt('named', 'sticker', [{ aiGenerated: false }])],
    mode: 'sticker',
    enabledModes: ['photo', 'sticker'],
    from: 'customize',
  }), 'mode-select');
});

test('back with zero or several prompts returns to the style screen', () => {
  assert.equal(routeBackFromPromptStep({
    prompts: [],
    mode: 'photo',
    from: 'camera',
  }), 'prompt-select');

  assert.equal(routeBackFromPromptStep({
    prompts: [photo('a'), photo('b')],
    mode: 'photo',
    from: 'customize',
  }), 'prompt-select');
});

test('kiosk wires the shared route and still gates disclaimer and capture', () => {
  const src = readFileSync(new URL('../components/KioskMode.tsx', import.meta.url), 'utf8');
  const proceed = src.slice(src.indexOf('const proceedToPrompts'), src.indexOf('const handleTapToStart'));
  const tap = src.slice(src.indexOf('const handleTapToStart'), src.indexOf('const handleDisclaimerAgree'));
  const agree = src.slice(src.indexOf('const handleDisclaimerAgree'), src.indexOf('const getAspectRatioDimensions'));

  assert.match(proceed, /routeAfterGuestContinues/);
  assert.doesNotMatch(proceed, /takePhoto|setCountdown|setView\('prompt-select'\)|setView\('camera'\)/);
  assert.match(tap, /setView\('disclaimer'\)/);
  assert.match(tap, /proceedToPrompts\(\)/);
  assert.match(agree, /proceedToPrompts\(\)/);
  assert.match(src, /routeAfterModeSelected/);
  assert.match(src, /routeBackFromPromptStep/);
  assert.equal(src.includes("setView('prompt-select')"), false);
  assert.match(src, /onClick=\{takePhoto\}/);
  assert.equal(src.includes('4955'), false);
  assert.equal(readFileSync(new URL('./kioskPromptFlow.ts', import.meta.url), 'utf8').includes('4955'), false);
});
