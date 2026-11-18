# Strømpris

## Tester

Backend-testene bruker Pythons innebygde `unittest` og kan kjøres fra `backend`:

```powershell
python -m unittest discover -s tests -v
```

Frontend-testene, ESLint og TypeScript-sjekken kjøres fra `frontend`:

```powershell
npm ci
npm test
npm run lint
npx tsc --noEmit
```

GitHub Actions kjører begge testsettene, lint og typesjekk automatisk ved push
og pull request. CI-jobbene trenger ikke Supabase-hemmeligheter.

## Supabase-hemmeligheter

- Hold `SUPABASE_SERVICE_ROLE_KEY` i GitHub Actions Secrets eller i en lokal
  `backend/.env`; ikke legg den i frontend eller i Git.
- Frontendens `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` er offentlig av design.
  Begrens derfor tilgang til `power_prices` med Supabase Row Level Security
  (RLS) og en lesetillatelse som bare gir tilgang til nødvendige prisdata.
- Backendens `.env`, virtuelle miljøer og Python-bytecode er ignorert av Git.
