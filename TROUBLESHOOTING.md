# Troubleshooting

Common issues and solutions when developing Faith Notebook locally.

## Blank Page / App Won't Load

### Checklist

1. **Check browser console** (F12) for errors
2. **Verify dev server is running** on http://localhost:5173
3. **Check environment variables** are set in `.env`
4. **Verify Supabase connection**:
   ```bash
   # Should show no errors on load
   npm run dev
   ```
5. **Clear browser cache** and hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
6. **Check for TypeScript errors**:
   ```bash
   npm run typecheck
   ```

### Common Causes

- **Missing `.env` file**: Create it in project root with all required variables
- **Invalid Supabase credentials**: Check URL and anon key match your project
- **Port already in use**: Vite will try port 5174, 5175, etc. Check terminal output
- **Node modules corrupted**: Delete `node_modules` and `package-lock.json`, run `npm install`

## Runtime Errors

### "Missing Supabase environment variables"

**Error**: Thrown by `src/lib/supabase.ts`

**Cause**: `.env` file missing or variables not prefixed with `VITE_`

**Fix**:
```env
# .env file
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_GEMINI_API_KEY=AIzaSy...
```

**Important**: All environment variables MUST start with `VITE_` to be accessible in client code.

### "Failed to fetch" or Network Errors

**Symptoms**: Login fails, notes don't save, blank sermon insights

**Causes**:
1. Supabase project is paused (free tier auto-pauses after inactivity)
2. Network connectivity issues
3. CORS errors (unlikely with Supabase)
4. Wrong Supabase URL

**Fixes**:
1. Check [Supabase dashboard](https://supabase.com/dashboard) - restore project if paused
2. Verify `VITE_SUPABASE_URL` matches your project
3. Check browser network tab (F12) for actual error responses

### "Session expired" or Auth Issues

**Symptoms**: Logged out unexpectedly, auth state flickers

**Causes**:
- Multiple tabs with different auth states
- Token expired (Supabase tokens last 1 hour by default)
- `onAuthStateChange` handler issues

**Fixes**:
1. Sign out and sign back in
2. Clear browser local storage for localhost:5173
3. Check for multiple `onAuthStateChange` listeners (memory leak)

### AI Chat Not Working

**Error**: API key errors, timeout, or blank responses

**Causes**:
1. Invalid or missing `VITE_GEMINI_API_KEY`
2. Gemini API quota exceeded
3. Network request blocked by ad blocker

**Fixes**:
1. Verify API key at [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Check quota limits in Google Cloud Console
3. Disable ad blocker or add localhost exception

## Lucide React Icon Issues

### Icons Blocked by Adblocker

**Symptoms**: Some icons don't render, console shows blocked resources

**Cause**: Ad blockers (uBlock Origin, AdBlock Plus) block icons named `Fingerprint`, `Shield`, `Lock`, etc.

**Workaround**:
1. **Whitelist localhost** in your ad blocker settings
2. **Disable ad blocker** for localhost:5173
3. **Use different icon names** if designing new features
4. **Build and preview**: Icons work in production builds
   ```bash
   npm run build
   npm run preview
   ```

### Icons Not Showing

**Symptoms**: Empty space where icon should be

**Fixes**:
1. Check import: `import { IconName } from 'lucide-react'`
2. Verify icon name exists in [Lucide docs](https://lucide.dev/icons/)
3. Check console for import errors
4. Rebuild: `npm run dev` (restart Vite)

## Database / Supabase Issues

### RLS Policy Errors

**Error**: "new row violates row-level security policy"

**Cause**: Row Level Security (RLS) policies prevent operation

**Fixes**:
1. Check if user is authenticated (`user` is not null)
2. Verify migrations were applied in correct order
3. Check `supabase/migrations/` for policy definitions
4. Use Supabase dashboard SQL editor to test queries manually

### Sermon Insights Not Showing

**Symptoms**: Clicking verse shows "No sermon insights for this verse yet"

**Causes**:
1. `sermon_verse_insights` table is empty
2. Verse reference format mismatch (e.g., "John 15:1" vs "John 15:1-2")
3. Migration not applied

**Fixes**:
1. Check database has data:
   ```sql
   SELECT * FROM sermon_verse_insights LIMIT 10;
   ```
2. Verify `parseVerseReference` function in `src/utils/verseParser.ts` handles format
3. Check `VersePanel.tsx` query joins with `sermons` table correctly

### Notes Not Saving

**Symptoms**: "Saving..." never completes, notes disappear on refresh

**Fixes**:
1. Check browser console for Supabase errors
2. Verify `notes` table RLS policies allow INSERT for authenticated users
3. Test in Supabase dashboard SQL editor:
   ```sql
   INSERT INTO notes (user_id, book, chapter, verse, content)
   VALUES ('your-user-id', 'John', 3, 16, 'test note');
   ```
4. Check `onBlur` handler in `VersePanel.tsx` isn't failing silently

## Build Errors

### TypeScript Errors During Build

**Error**: `npm run build` fails with type errors

**Fix**:
```bash
# Check types first
npm run typecheck

# Common issues:
# - Missing type definitions
# - Incorrect prop types
# - Unused variables (remove or prefix with _)
```

### Tailwind CSS Not Working

**Symptoms**: Classes have no effect, no styling

**Fixes**:
1. Check `tailwind.config.js` has correct `content` paths
2. Verify `@tailwind` directives in `src/index.css`
3. Restart dev server: `npm run dev`
4. Clear browser cache

## Development Tips

### Hot Module Replacement (HMR) Not Working

**Symptoms**: Changes don't reflect without manual refresh

**Fixes**:
1. Restart dev server
2. Check file is saved (VS Code auto-save)
3. Avoid circular imports
4. Check Vite terminal output for errors

### Slow Development Server

**Causes**:
- Large `node_modules`
- Too many files watched by Vite
- Antivirus scanning files

**Fixes**:
1. Add `node_modules` to antivirus exclusions
2. Close unused browser tabs
3. Restart Vite

### ESLint Warnings Everywhere

**Fix**:
```bash
# Auto-fix what's possible
npm run lint -- --fix
```

## Getting More Help

1. **Check browser console** (F12) - most errors are logged there
2. **Check Vite terminal** - server-side errors appear here
3. **Supabase logs**: Dashboard → Logs → API/Auth logs
4. **Test Supabase connection**: Dashboard → SQL Editor → run test query
5. **Verify migrations**: Dashboard → Database → Migrations

## Useful Debug Commands

```bash
# Clear all caches and reinstall
rm -rf node_modules dist .vite package-lock.json
npm install

# Test TypeScript compilation
npm run typecheck

# Lint and fix
npm run lint -- --fix

# Check Supabase client connection
# (Add this temporarily to App.tsx)
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
```

## Hard Reset

If nothing works, start fresh:

```bash
# 1. Stop dev server (Ctrl+C)
# 2. Clear everything
rm -rf node_modules dist .vite package-lock.json

# 3. Reinstall
npm install

# 4. Verify .env exists and is correct
cat .env

# 5. Restart
npm run dev
```

## Known Limitations

- **No offline support**: App requires internet for Supabase and AI
- **No server-side rendering**: Pure client-side app
- **Gemini API key exposed**: Implement rate limiting via Supabase Edge Functions for production
- **No real-time updates**: Community notes require manual refresh
- **Bible text is static**: No dynamic Bible translation switching
