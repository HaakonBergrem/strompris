"""
Fetches hourly electricity prices from hvakosterstrommen.no
and stores them in Supabase.

"""

import os
from datetime import date, datetime
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# Config supabase connection
REGIONS = ("NO1", "NO2", "NO3", "NO4", "NO5")
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TABLE_NAME = "power_prices"

# Builds API URL for a given date and region, and returns a JSON object from "hvakosterstrommen.no"
def build_api_url(day: date, region: str) -> str:
    return (
        f"https://www.hvakosterstrommen.no/api/v1/prices/"
        f"{day.year}/{day.month:02d}-{day.day:02d}_{region}.json"
    )


# Fetches hourly prices for a given date and region
def fetch_prices(day: date, region: str) -> list[dict]:
    url = build_api_url(day, region)
    print(f"Fetching: {url}")

    response = requests.get(url, timeout=30)
    response.raise_for_status()
    data = response.json()

    # Raise error if the returned JSON is not a list or is empty, and stops program
    if not isinstance(data, list) or len(data) == 0:
        raise ValueError(f"Unexpected API response for {region} on {day}")

    print(f"Got {len(data)} hourly rows")
    return data

# Converts API JSON into rows that match the Supabase table
def to_rows(raw: list[dict], region: str) -> list[dict]:
    rows = []
    for item in raw:
        rows.append({
            "power_price": item["NOK_per_kWh"],
            "region": region,
            "time_start": item["time_start"],
            "time_end": item["time_end"],
        })
    return rows

# Inserts rows into Supabase
def upsert_prices(rows: list[dict]) -> None:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Uses upsert on (region, time_start) so re-runs do not create duplicates
    result = (
        supabase.table(TABLE_NAME)
        .upsert(rows, on_conflict="region,time_start")
        .execute()
    )

    print(f"Upserted {len(rows)} rows into '{TABLE_NAME}'")
    return result


def main() -> None:
    today = datetime.now(ZoneInfo("Europe/Oslo")).date()
    for region in REGIONS:
        print(f"Fetching prices for {today} / {region}")
        raw = fetch_prices(today, region)
        rows = to_rows(raw, region)
        upsert_prices(rows)

    print("Done")


if __name__ == "__main__":
    main()