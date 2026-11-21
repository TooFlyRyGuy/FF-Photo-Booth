import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('..', import.meta.url).pathname;
const migration = readFileSync(
  join(root, 'supabase/migrations/20261120192946_20261120150000_credit_security_fix.sql.sql'),
  'utf8'
);

const SERVER_ONLY = [
  'add_purchased_credits',
  'add_purchased_sms_credits',
  'add_event_pass_credits',
  'add_event_pass_sms_credits',
  'increment_image_usage',
  'increment_sms_usage',
  'increment_user_image_usage',
  'increment_user_sms_usage',
  'consume_sms_credit',
];

const clientFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return clientFiles(full);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [full] : [];
  });

const browserCode = [
  ...clientFiles(join(root, 'components')),
  ...clientFiles(join(root, 'services')),
  ...clientFiles(join(root, 'lib')),
  join(root, 'App.tsx'),
].map(f => ({ f, src: readFileSync(f, 'utf8') }));

test('browser code never calls the server-only credit functions', () => {
  for (const fn of SERVER_ONLY) {
    for (const { f, src } of browserCode) {
      assert.equal(src.includes(`rpc('${fn}'`), false, `${f} calls ${fn}`);
    }
  }
});

test('the migration revokes every server-only function from public roles and keeps service_role', () => {
  for (const fn of SERVER_ONLY) {
    assert.match(migration, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\(.*FROM PUBLIC, anon, authenticated;`));
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\(.*TO service_role;`));
  }
});

test('consume_credit stays callable by the kiosk and is made safe', () => {
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.consume_credit\(uuid, integer\) TO anon, authenticated, service_role;/);
  assert.match(migration, /FOR UPDATE;/);
  assert.match(migration, /v_event \+ v_sub \+ v_pur < p_amount THEN\s+RETURN false;/);
  assert.match(migration, /INSERT INTO public\.credit_ledger/);
  // The kiosk and Prompt Library still call it with the same arguments.
  const credit = readFileSync(join(root, 'services/creditService.ts'), 'utf8');
  assert.match(credit, /rpc\('consume_credit', \{\s+p_user_id: userId,\s+p_amount: amount,/);
});

test('users can no longer update their own balance', () => {
  assert.match(migration, /DROP POLICY IF EXISTS "Users can update credits" ON public\.user_credits;/);
  assert.match(migration, /CREATE POLICY "Admins can update credits"[\s\S]*USING \(\(SELECT public\.user_is_admin\(\)\)\)/);
  // The only browser UPDATE of user_credits is the admin User Management screen.
  const updaters = browserCode
    .filter(({ src }) => /from\('user_credits'\)\s*\.update\(/.test(src))
    .map(({ f }) => f.replace(root, ''));
  assert.deepEqual(updaters.sort(), ['components/UserManagement.tsx', 'services/subscriptionService.ts']);
});
