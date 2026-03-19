# Architecture

This document explains the Faith Notebook application architecture.

## Entry Point

**File**: `index.html` → `src/main.tsx`

The app initializes at `src/main.tsx`, which:
1. Renders the React app into `<div id="root">`
2. Wraps the app in `<StrictMode>` and `<AuthProvider>`
3. Loads global styles from `src/index.css`

## Root Component Tree

```
main.tsx
└── AuthProvider (context/AuthContext.tsx)
    └── App (src/App.tsx)
        ├── Navigation
        ├── BibleReader
        │   └── VersePanel (modal)
        └── AIChatTab (modal)
```

### Component Responsibilities

- **App.tsx**: Root component, manages book/chapter navigation and auth state
- **AuthForm**: Login and signup form (shown when user is not authenticated)
- **Navigation**: Top navigation bar with book/chapter selector and AI chat button
- **BibleReader**: Displays Bible verses, handles verse click to open VersePanel
- **VersePanel**: Modal showing sermon insights, community notes, and personal notes for a verse
- **AIChatTab**: Side panel for AI-powered Bible Q&A using Gemini

## Routing

**No routing library used.** Navigation is state-based:

- Book and chapter are tracked in `App.tsx` state
- Changed via `onNavigate` callback passed to `Navigation`
- Modals (VersePanel, AIChatTab) use `boolean` state flags

## Data Layer

### Bible Text (Static)

- **Location**: `src/data/bibleText.ts`, `src/data/bibleBooks.ts`
- **Format**: TypeScript objects with book/chapter/verse structure
- **Usage**: Read directly in `BibleReader` component

### User Data (Supabase)

All user-generated data is stored in Supabase:

**Tables**:
- `profiles`: User profiles (display_name)
- `notes`: User's private/public verse notes
- `shared_notes`: Public notes visible to all users
- `note_likes`: Likes on shared notes
- `sermons`: Sermon metadata (title, speaker, church, date)
- `sermon_verse_insights`: Verse-specific insights from sermons

**Client**: `src/lib/supabase.ts` exports configured Supabase client

**Database Functions**:
- `increment_likes`: Atomic like count increment
- `decrement_likes`: Atomic like count decrement

### Authentication

- **Provider**: `src/context/AuthContext.tsx`
- **Methods**: `signIn`, `signUp`, `signOut`
- **State**: `user` (User | null), `loading` (boolean)
- **Flow**: Supabase Auth with email/password

### AI Integration

- **Provider**: Google Gemini API
- **Location**: `src/components/AIChatTab.tsx`
- **Usage**: Sends user questions + Bible context to Gemini for answers

## Data Flow Examples

### Viewing a Verse's Notes

1. User clicks verse in `BibleReader`
2. `BibleReader` sets `selectedVerse` state, opens `VersePanel`
3. `VersePanel` queries:
   - `sermon_verse_insights` + `sermons` (for sermon tab)
   - `shared_notes` (for community tab)
   - `notes` (for my notes tab)
4. User interacts with tabs, data updates via Supabase mutations

### Liking a Community Note

1. User clicks heart icon in `VersePanel` community tab
2. `toggleLike` function:
   - Inserts/deletes from `note_likes` table
   - Calls `increment_likes` or `decrement_likes` RPC
3. Reloads `shared_notes` to reflect new like count

### AI Chat

1. User types question in `AIChatTab`
2. Component fetches relevant Bible text from `bibleText.ts`
3. Sends prompt + context to Gemini API
4. Displays streamed response

## Key Files to Read First

Start here for best understanding:

1. **src/main.tsx** - Entry point and provider setup
2. **src/App.tsx** - Root component, navigation state
3. **src/context/AuthContext.tsx** - Auth logic and session management
4. **src/lib/supabase.ts** - Supabase client and type definitions
5. **src/components/BibleReader.tsx** - Main Bible reading UI
6. **src/components/VersePanel.tsx** - Verse details modal (notes, sermons, community)
7. **src/data/bibleText.ts** - Static Bible text structure
8. **supabase/migrations/** - Database schema (read in chronological order)

## Styling

- **Framework**: Tailwind CSS
- **Config**: `tailwind.config.js`, `postcss.config.js`
- **Theme Colors**:
  - `#faf8f4` - Background (warm off-white)
  - `#c49a5c` - Primary accent (gold)
  - `#2c1810` - Text (dark brown)
- **Design**: Clean, serif typography with Bible-reading focus

## Build Configuration

- **Tool**: Vite 5
- **Config**: `vite.config.ts`
- **Special**: `lucide-react` excluded from optimization (see `optimizeDeps.exclude`)
- **Output**: `dist/` folder

## Environment Variables

All env vars must be prefixed with `VITE_` to be available in client code:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY`

Access via `import.meta.env.VITE_*`

## Security

- **RLS**: All Supabase tables use Row Level Security
- **Policies**: Users can only access their own notes (unless public)
- **Auth**: Supabase handles JWT tokens automatically
- **API Keys**: Gemini API key exposed on client (use quota limits)

## Future Considerations

- Add routing for shareable verse links
- Offline support with service workers
- Export notes functionality
- More sermon data sources
