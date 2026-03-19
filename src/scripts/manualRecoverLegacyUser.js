import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (!current.startsWith('--')) continue;
    args[current.slice(2)] = next;
    i += 1;
  }

  return args;
}

function printUsage() {
  console.log(`
Manual legacy account recovery

Lookup only:
  node ./src/scripts/manualRecoverLegacyUser.js --username malik
  node ./src/scripts/manualRecoverLegacyUser.js --recovery-email person@example.com

Reset the existing account password in place:
  node ./src/scripts/manualRecoverLegacyUser.js --username malik --set-password "NewPassword123"

Notes:
  - This updates the same auth user id.
  - It does not create a new account.
  - It does not move or recreate notes, chats, or profile rows.
  - It does not change the legacy sign-in username mapping.
`);
}

async function main() {
  const args = parseArgs(process.argv);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  if (!supabaseUrl || !serviceKey) {
    console.error('SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_KEY must be set.');
    process.exit(1);
  }

  if (!args.username && !args['recovery-email'] && !args['display-name']) {
    console.error('Provide at least one lookup field: --username, --recovery-email, or --display-name');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let query = supabase
    .from('profiles')
    .select('id, username, display_name, recovery_email, account_setup_completed_at');

  if (args.username) {
    query = query.eq('username', args.username.trim());
  }
  if (args['recovery-email']) {
    query = query.eq('recovery_email', args['recovery-email'].trim().toLowerCase());
  }
  if (args['display-name']) {
    query = query.ilike('display_name', args['display-name'].trim());
  }

  const { data, error } = await query.limit(5);

  if (error) {
    console.error('Profile lookup failed:', error.message || error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.error('No matching legacy account found.');
    process.exit(1);
  }

  if (data.length > 1) {
    console.error('More than one account matched. Narrow the lookup before resetting a password.\n');
    console.table(data);
    process.exit(1);
  }

  const profile = data[0];
  console.log('Matched account:');
  console.table([profile]);

  if (!args['set-password']) {
    console.log('\nLookup complete. No password change requested.');
    process.exit(0);
  }

  if (args.dryRun) {
    console.log('\nDRY RUN: would reset password for this existing auth user id without creating a new account.');
    process.exit(0);
  }

  const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
    profile.id,
    { password: args['set-password'] }
  );

  if (updateError) {
    console.error('Password reset failed:', updateError.message || updateError);
    process.exit(1);
  }

  console.log('\nPassword updated in place for the existing account.');
  console.log(`Auth user id preserved: ${updatedUser.user?.id || profile.id}`);
  console.log('The user can now sign back in with the same username and the new password.');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
