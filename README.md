# Faith Notebook

A Bible reading app with verse-level note-taking, sermon insights, and AI-powered Bible chat powered by Supabase and Gemini.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Supabase account with a configured project
- A Google Gemini API key

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file in the project root with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

For production on Vercel, set this server-only variable in Vercel Project Settings → Environment Variables:

```env
GEMINI_API_KEY=your_gemini_api_key
```

AI requests are proxied through `api/gemini-chat.js`, so the Gemini key is never exposed to browsers.

### Run Supabase Migrations

Migrations are located in `supabase/migrations/`. Apply them in order using the Supabase CLI or dashboard.

## Available Commands

```bash
# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run ESLint
npm run lint

# Type check TypeScript
npm run typecheck
```

## Features

- **Bible Reading**: Read any chapter from Matthew to Revelation
- **Verse Notes**: Click any verse to add private or public notes
- **Sermon Insights**: View sermon insights linked to specific verses
- **Community Notes**: Share notes publicly and like others' notes
- **AI Chat**: Ask questions about Bible passages using Gemini AI
- **Authentication**: Email/password authentication via Supabase

## Project Structure

```
src/
├── components/       # React components
├── context/          # React context (AuthContext)
├── data/             # Static Bible text and book metadata
├── lib/              # Supabase client configuration
└── utils/            # Utility functions (verse parsing)

supabase/
└── migrations/       # Database schema migrations
```

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **AI**: Google Gemini API

## Key Dependencies

- `react` + `react-dom`: UI framework
- `@supabase/supabase-js`: Supabase client
- `lucide-react`: Icon library
- `tailwindcss`: Utility-first CSS
- `vite`: Build tool and dev server

## VS Code Setup

Install recommended extensions:
- ESLint
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features

## Additional Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture overview
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
