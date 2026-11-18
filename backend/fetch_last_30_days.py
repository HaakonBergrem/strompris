"""Fetch the last 30 days of electricity prices and upsert them into Supabase."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fetch_prices import REGIONS, fetch_prices, to_rows, upsert_prices


def get_last_30_days(today: date) -> list[date]:
    return [today - timedelta(days=offset) for offset in range(29, -1, -1)]


def upsert_in_batches(rows: list[dict], batch_size: int = 500) -> None:
    if batch_size <= 0:
        raise ValueError("Batch size must be greater than zero")

    for start in range(0, len(rows), batch_size):
        upsert_prices(rows[start : start + batch_size])


def main() -> None:
    today = datetime.now(ZoneInfo("Europe/Oslo")).date()
    days = get_last_30_days(today)
    all_rows = []

    for day in days:
        for region in REGIONS:
            print(f"Fetching prices for {day} / {region}")
            raw = fetch_prices(day, region)
            all_rows.extend(to_rows(raw, region))

    # Upsert in batches of 500 to avoid hitting Supabase's row limit
    upsert_in_batches(all_rows)

    print(f"Done: fetched prices from {days[0]} through {today}")


if __name__ == "__main__":
    main()
