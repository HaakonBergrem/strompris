# Strømblikk Backend

The backend fetches hourly electricity prices from the [hvakosterstrommen.no API](https://www.hvakosterstrommen.no/strompris-api) for Norway's five price regions (NO1–NO5) and upserts them into Supabase.

## Requirements

- Python 3.12 (the version used by CI)
- pip
- A Supabase project with a `power_prices` table

## Install

Run these commands from `backend/`.

PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Configure Supabase

Create a `backend/.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

The service-role key grants elevated access. Keep it private, do not commit `.env`, and never use this key in the frontend. The backend loads the file locally; GitHub Actions receives the same values through repository secrets.

The `power_prices` table must contain the columns `power_price`, `region`, `time_start`, and `time_end`. The backend upserts using `region,time_start` as the conflict key, so configure a unique constraint or unique index on those columns in Supabase. Prices are stored as returned by the API in NOK/kWh; VAT adjustment is handled by the frontend.

## Fetch today's prices

From `backend/`, run:

```powershell
python fetch_prices.py
```

The script uses the current date in `Europe/Oslo`, fetches each of the five price areas, validates the API response, and upserts the hourly records. Running it again updates matching records rather than creating duplicates.

## Backfill the last 30 days

From `backend/`, run:

```powershell
python fetch_last_30_days.py
```

This manually fetches 30 calendar days, including today, for all five regions and upserts the results in batches of 500. It writes to Supabase; only run it when you intend to populate or refresh historical data. This script is not part of the scheduled workflow.

## Tests

Run the backend unit tests from `backend/`:

```powershell
python -m unittest discover -s tests -v
```

The tests cover API-data validation, Supabase upsert behavior, date-window calculation, and batch handling. They do not require live API or Supabase credentials.
