"""
Fetch hourly power prices for today for each region in Norway from the "hvakosterstrommen.no" API and upserts them into a Supabase table.

"""

import os
from datetime import date, datetime
from math import isfinite
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables from .env file
load_dotenv()

# Config supabase connection
REGIONS = ("NO1", "NO2", "NO3", "NO4", "NO5")
TABLE_NAME = "power_prices"

# Builds API URL for a given date and region, and returns a JSON object from "hvakosterstrommen.no"
def build_api_url(day: date, region: str) -> str:
    if region not in REGIONS:
        raise ValueError(f"Unsupported price region: {region}")

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

    for index, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(f"Invalid price record at index {index}")

        price = item.get("NOK_per_kWh")
        valid_price = isinstance(price, (int, float)) and not isinstance(price, bool)
        if valid_price:
            try:
                valid_price = isfinite(price)
            except OverflowError:
                valid_price = False
        if not valid_price:
            raise ValueError(f"Invalid price value at index {index}")

        try:
            time_start = datetime.fromisoformat(item["time_start"])
            time_end = datetime.fromisoformat(item["time_end"])
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(f"Invalid time range at index {index}") from error

        if time_end <= time_start:
            raise ValueError(f"Invalid time range at index {index}")

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

# Upserts rows into Supabase
def upsert_prices(rows: list[dict]) -> None:
    if not rows:
        raise ValueError("Cannot upsert an empty list of prices")

    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured"
        )

    supabase = create_client(supabase_url, service_role_key)

    # Uses upsert on (region, time_start) so re-runs do not create duplicates
    (
        supabase.table(TABLE_NAME)
        .upsert(rows, on_conflict="region,time_start")
        .execute()
    )

    print(f"Upserted {len(rows)} rows into '{TABLE_NAME}'")


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