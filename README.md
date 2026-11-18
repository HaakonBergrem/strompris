# Strømblikk

Strømblikk is a Norwegian electricity-price dashboard. It displays hourly prices and recent daily averages for Norway's five price regions, using data stored in Supabase.
The data is retrieved from [hvakosterstrommen.no API](https://www.hvakosterstrommen.no/strompris-api).
## Project structure

- [`frontend/`](./frontend/README.md) contains the Next.js dashboard and frontend tests.
- [`backend/`](./backend/README.md) contains the Python price-fetching scripts and backend tests.
- [`.github/workflows/`](./.github/workflows/) contains the automated test and scheduled price-fetch workflows.

## Quick start

1. Configure the frontend environment variables described in [`frontend/README.md`](./frontend/README.md).
2. Install and start the frontend:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

The dashboard requires price records in the Supabase `power_prices` table. See [`backend/README.md`](./backend/README.md) for backend setup and data-fetching instructions.

## CI/CD

The `Test` GitHub Actions workflow runs on pushes and pull requests. It runs the Python unit tests, frontend tests, production dependency audit, lint, TypeScript check, and production build. These checks do not require real Supabase credentials.

The separate `Fetch electricity prices` workflow runs on its daily schedule and can also be started manually in GitHub Actions. It requires the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` repository secrets.

Vercel is used for deploying and hosting the application. It can be found here: [strompris-chi.vercel.app](https://strompris-chi.vercel.app).

## Security

- Never commit `.env` files, service-role keys, or other credentials.
- Keep the Supabase service-role key in the backend environment or GitHub Actions secrets only. Never expose it to the frontend.
- The frontend Supabase URL and publishable key are public client configuration. Protect table access with Supabase Row Level Security (RLS), and allow only the reads the dashboard needs.
