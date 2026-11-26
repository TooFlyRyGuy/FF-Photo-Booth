import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { queuedSendChannels } from './kioskSend.ts';

const between = (src: string, start: string, end: string) => {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `missing ${start}`);
  const j = src.indexOf(end, i + start.length);
  assert.ok(j > i, `missing ${end}`);
  return src.slice(i, j);
};

test('a queued email does not also send SMS just because a phone number is filled in', () => {
  assert.deepEqual(queuedSendChannels({
    smsEnabled: true,
    emailEnabled: true,
    smsQueued: false,
    emailQueued: true,
    phone: '5551234567',
    email: 'guest@example.com',
  }), ['email']);
});

test('a queued SMS does not also send email just because an address is filled in', () => {
  assert.deepEqual(queuedSendChannels({
    smsEnabled: true,
    emailEnabled: true,
    smsQueued: true,
    emailQueued: false,
    phone: '5551234567',
    email: 'guest@example.com',
  }), ['sms']);
});

test('each queued channel is included on its own, and an unqueued pair sends nothing', () => {
  assert.deepEqual(queuedSendChannels({
    smsEnabled: true,
    emailEnabled: true,
    smsQueued: true,
    emailQueued: true,
    phone: '5551234567',
    email: 'guest@example.com',
  }), ['sms', 'email']);
  assert.deepEqual(queuedSendChannels({
    smsEnabled: true,
    emailEnabled: true,
    smsQueued: false,
    emailQueued: false,
    phone: '5551234567',
    email: 'guest@example.com',
  }), []);
});

test('sharing and processing send buttons each trigger only their own channel', () => {
  const kiosk = readFileSync(new URL('../components/KioskMode.tsx', import.meta.url), 'utf8');

  const emailHandler = between(kiosk, 'const handleSendEmail = async () => {', 'const resetKiosk');
  assert.match(emailHandler, /beginSending\('email'\)/);
  assert.doesNotMatch(emailHandler, /sendSms\(/);
  assert.doesNotMatch(emailHandler, /setSmsQueued\(true\)/);
  assert.doesNotMatch(emailHandler, /beginSending\('sms'\)/);
  assert.doesNotMatch(emailHandler, /setSmsSending\(true\)/);

  const smsButton = between(kiosk, '{smsSent && (smsSentTo || phoneNumber)', 'onClick={handleSendWhatsApp}');
  const emailButton = between(kiosk, '{emailSent && (emailSentTo || emailAddress)', 'shareUrl && shareUrl.length');
  assert.match(smsButton, /type="button"/);
  assert.match(smsButton, /onClick=\{handleSendSms\}/);
  assert.match(smsButton, /smsSending/);
  assert.doesNotMatch(smsButton, /emailSending/);
  assert.doesNotMatch(smsButton, /isSending/);
  assert.match(emailButton, /type="button"/);
  assert.match(emailButton, /onClick=\{handleSendEmail\}/);
  assert.match(emailButton, /emailSending/);
  assert.doesNotMatch(emailButton, /smsSending/);
  assert.doesNotMatch(emailButton, /isSending/);

  const processingEmail = between(kiosk, 'onClick={() => { setEmailQueued(true); }}', "t('kiosk.invalidEmail')");
  assert.match(kiosk, /<button\s+type="button"\s+onClick=\{\(\) => \{ setEmailQueued\(true\); \}\}/);
  assert.doesNotMatch(processingEmail, /setSmsQueued/);
  assert.doesNotMatch(processingEmail, /setSmsSending/);
  assert.doesNotMatch(processingEmail, /handleSendSms/);
});
