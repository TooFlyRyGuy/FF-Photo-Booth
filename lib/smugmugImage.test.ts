import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { eventPhotoEmailImageUrl, SAMPLE_EMAIL_IMAGE_URL, smugmugDirectImageUrl } from './smugmugImage.ts';

const direct = (key: string) => `https://photos.smugmug.com/photos/${key}/0/XL/${key}-XL.jpg`;

test('custom-domain SmugMug page becomes a direct XL jpeg', () => {
  const page = 'https://gallery.funframephoto.com/Photo-Booth-Galleries/AI-photo-booth/Snowflake-AWS-Reinvent/i-L4HLXnh';
  assert.equal(smugmugDirectImageUrl(page), direct('i-L4HLXnh'));
});

test('smugmug.com hosts convert when the path ends in the image key', () => {
  assert.equal(
    smugmugDirectImageUrl('https://funframe.smugmug.com/Album/Name/i-AbC123/'),
    direct('i-AbC123'),
  );
  assert.equal(
    smugmugDirectImageUrl('https://www.smugmug.com/Gallery/i-Z9/?u=1#photo'),
    direct('i-Z9'),
  );
  assert.equal(
    smugmugDirectImageUrl('http://SMUGMUG.com/Event/i-Key1'),
    direct('i-Key1'),
  );
  assert.equal(
    smugmugDirectImageUrl('https://Gallery.FunFramePhoto.com/Album/i-L4HLXnh'),
    direct('i-L4HLXnh'),
  );
});

test('non-page URLs stay unchanged', () => {
  const storage = 'https://abc.supabase.co/storage/v1/object/public/event-photos/photo.jpg';
  assert.equal(smugmugDirectImageUrl(storage), storage);

  const sneaky = 'https://example.com/album/i-L4HLXnh';
  assert.equal(smugmugDirectImageUrl(sneaky), sneaky);

  const album = 'https://gallery.funframephoto.com/Photo-Booth-Galleries/AI-photo-booth/';
  assert.equal(smugmugDirectImageUrl(album), album);

  const already = direct('i-L4HLXnh');
  assert.equal(smugmugDirectImageUrl(already), already);

  const sized = 'https://photos.smugmug.com/photos/i-L4HLXnh/0/L/i-L4HLXnh-L.jpg';
  assert.equal(smugmugDirectImageUrl(sized), sized);

  assert.equal(smugmugDirectImageUrl('not a url'), 'not a url');
  assert.equal(smugmugDirectImageUrl(''), '');
});

test('a test email uses the latest event photo, or the sample image when there is none', () => {
  assert.equal(eventPhotoEmailImageUrl(null), SAMPLE_EMAIL_IMAGE_URL);
  assert.equal(eventPhotoEmailImageUrl({}), SAMPLE_EMAIL_IMAGE_URL);
  assert.equal(
    eventPhotoEmailImageUrl({
      smugmug_url: 'https://gallery.funframephoto.com/Album/i-L4HLXnh',
      public_url: 'https://abc.supabase.co/storage/v1/object/public/event-photos/photo.jpg',
    }),
    direct('i-L4HLXnh'),
  );
  const storage = 'https://abc.supabase.co/storage/v1/object/public/event-photos/photo.jpg';
  assert.equal(eventPhotoEmailImageUrl({ public_url: storage, smugmug_url: '  ' }), storage);
});

test('admin test email sends the sample and waits for a saved subject and body', () => {
  const admin = readFileSync(new URL('../components/AdminDashboard.tsx', import.meta.url), 'utf8');
  assert.match(admin, /Save changes before testing/);
  assert.match(admin, /getEventEmailTestSample\(editingEvent\.id\)/);
  assert.match(admin, /sendEmail\(testEmailAddress\.trim\(\), sample\.imageUrl, sample\.imageId, editingEvent\.id\)/);
  assert.match(admin, /setTestEmailStatus\(ok \? 'sent' : 'failed'\)/);
});

test('kiosk email uses the direct image and sms keeps the page url', () => {
  const kiosk = readFileSync(new URL('../components/KioskMode.tsx', import.meta.url), 'utf8');
  assert.match(kiosk, /sendEmail\(\s*email,\s*smugmugDirectImageUrl\(pageUrl\)/);
  assert.match(kiosk, /sendEmail\(\s*emailAddress\.trim\(\),\s*smugmugDirectImageUrl\(shareUrl\)/);

  const smsCalls = [...kiosk.matchAll(/sendSms\([^)]*\)/g)].map((match) => match[0]);
  assert.ok(smsCalls.length >= 2);
  for (const call of smsCalls) {
    assert.equal(call.includes('smugmugDirectImageUrl'), false, call);
  }
});
