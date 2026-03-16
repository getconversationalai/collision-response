# Collision Response

Client portal for auto collision companies to manage their MVA (Motor Vehicle Accident) SMS notification subscriptions.

## Features

- **Login** — Email/password authentication via Supabase Auth
- **Dashboard** — Toggle location subscriptions on/off per municipality, edit phone number
- **Notification History** — View past MVA notifications with status tracking

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- Supabase (PostgreSQL, Auth, Row Level Security)
- Tailwind CSS

## Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Run the dev server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deploy to Vercel. Set the environment variables in your Vercel project settings.
