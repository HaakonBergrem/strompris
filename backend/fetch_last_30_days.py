"""Fetch the last 30 days of electricity prices and upsert them into Supabase."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fetch_prices import REGIONS, fetch_prices, to_rows, upsert_prices


def main() -> None:
    today = datetime.now(ZoneInfo("Europe/Oslo")).date()
    start_day = today - timedelta(days=29)
    all_rows = []

    day = start_day
    while day <= today:
        for region in REGIONS:
            print(f"Fetching prices for {day} / {region}")
            raw = fetch_prices(day, region)
            all_rows.extend(to_rows(raw, region))
        day += timedelta(days=1)

    for start in range(0, len(all_rows), 500):
        upsert_prices(all_rows[start : start + 500])

    print(f"Done: fetched prices from {start_day} through {today}")


if __name__ == "__main__":
    main()
