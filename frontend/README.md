# Strømblikk Frontend

The frontend is a Next.js application that displays electricity prices from the Supabase `power_prices` table.

## Requirements

- Node.js 22 (the version used by CI)
- npm
- A Supabase project with the `power_prices` table populated by the backend

## Configuration

Create `frontend/.env.local` with the public Supabase project URL and publishable key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

These values are exposed to the browser by design. Do not put a Supabase service-role key or any other secret in a `NEXT_PUBLIC_` variable. The frontend `.gitignore` excludes environment files.

Configure Supabase Row Level Security (RLS) so browser clients can read only the required price data. The dashboard reads from `power_prices`, selecting `region`, `time_start`, `time_end`, and `power_price` for the selected region.

## Install and run

From this directory:

```powershell
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The page reloads when source files change.

## Available commands

Run these commands from `frontend/`:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm test` | Run the Vitest unit tests. |
| `npm run lint` | Run ESLint. |
| `npx tsc --noEmit` | Check TypeScript types without emitting files. |
| `npm run build` | Create a production build. |
| `npm start` | Serve the production build; run `npm run build` first. |
| `npm audit --omit=dev --audit-level=moderate` | Audit production dependencies for moderate or higher severity vulnerabilities. |

## Dashboard behavior

- Users can choose among the five Norwegian price areas: NO1–NO5.
- The dashboard shows today's hourly prices and recent daily averages.
- Dates and hourly labels are interpreted in the `Europe/Oslo` time zone.
- Displayed prices include VAT for all areas except NO4.
- The hourly chart marks the hour that is currently in progress.

The frontend queries up to 32 days of data to prepare the 30-day view. If prices are missing, check that the backend has populated `power_prices` and that the Supabase RLS policy allows the required read.
