# TrackBin React App

## Setup Instructions

### 1. Environment Variables

Copy the `.env.local` file and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://aimtlnmgqawsghiwajzb.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key_here
```

You can find your anon key in Supabase Dashboard → Settings → API → Project API keys.

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173

## Project Structure

```
src/
├── components/
│   └── Layout/          # Sidebar and main layout components
├── lib/
│   └── supabase.ts      # Supabase client configuration
├── pages/
│   └── Dashboard.tsx    # Dashboard page
├── types/
│   └── database.ts      # TypeScript types for database entities
└── App.tsx              # Main app with routing
```

## Features

- ✅ React + TypeScript + Vite
- ✅ Supabase integration
- ✅ React Router for navigation
- ✅ Responsive sidebar layout (ChatGPT-style)
- ✅ TypeScript types for all database entities
- 🚧 Database schema (next step)
- 🚧 Authentication
- 🚧 CRUD operations for inventory

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Routing**: React Router v6
- **Styling**: CSS Modules
- **State Management**: React hooks (Context API for global state when needed)
