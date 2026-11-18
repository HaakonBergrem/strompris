import os
import unittest
from datetime import date
from unittest.mock import Mock, patch

import requests

import fetch_prices


class FetchPricesTests(unittest.TestCase):
    def setUp(self):
        self.valid_record = {
            "NOK_per_kWh": 1.25,
            "time_start": "2026-11-18T00:00:00+01:00",
            "time_end": "2026-11-18T01:00:00+01:00",
        }

    def test_build_api_url_formats_date_and_region(self):
        self.assertEqual(
            fetch_prices.build_api_url(date(2026, 2, 3), "NO1"),
            "https://www.hvakosterstrommen.no/api/v1/prices/2026/02-03_NO1.json",
        )

    def test_build_api_url_rejects_unknown_region(self):
        with self.assertRaises(ValueError):
            fetch_prices.build_api_url(date(2026, 2, 3), "../other")

    @patch("fetch_prices.requests.get")
    def test_fetch_prices_returns_valid_rows_and_uses_timeout(self, get):
        response = Mock()
        response.json.return_value = [self.valid_record]
        get.return_value = response

        result = fetch_prices.fetch_prices(date(2026, 11, 18), "NO1")

        self.assertEqual(result, [self.valid_record])
        get.assert_called_once_with(
            "https://www.hvakosterstrommen.no/api/v1/prices/2026/11-18_NO1.json",
            timeout=30,
        )
        response.raise_for_status.assert_called_once()

    @patch("fetch_prices.requests.get")
    def test_fetch_prices_propagates_http_errors(self, get):
        response = Mock()
        response.raise_for_status.side_effect = requests.HTTPError("unavailable")
        get.return_value = response

        with self.assertRaises(requests.HTTPError):
            fetch_prices.fetch_prices(date(2026, 11, 18), "NO1")

    @patch("fetch_prices.requests.get")
    def test_fetch_prices_rejects_empty_or_non_list_responses(self, get):
        response = Mock()
        get.return_value = response

        for payload in ([], {}, None):
            with self.subTest(payload=payload):
                response.json.return_value = payload
                with self.assertRaises(ValueError):
                    fetch_prices.fetch_prices(date(2026, 11, 18), "NO1")

    @patch("fetch_prices.requests.get")
    def test_fetch_prices_rejects_invalid_price_and_time_ranges(self, get):
        invalid_records = [
            {**self.valid_record, "NOK_per_kWh": float("nan")},
            {**self.valid_record, "NOK_per_kWh": float("inf")},
            {**self.valid_record, "NOK_per_kWh": True},
            {**self.valid_record, "NOK_per_kWh": 10**1000},
            {**self.valid_record, "time_start": "not-a-date"},
            {
                **self.valid_record,
                "time_start": "2026-11-18T02:00:00+01:00",
                "time_end": "2026-11-18T01:00:00+01:00",
            },
            {"NOK_per_kWh": 1.25},
        ]
        response = Mock()
        get.return_value = response

        for record in invalid_records:
            with self.subTest(record=record):
                response.json.return_value = [record]
                with self.assertRaises(ValueError):
                    fetch_prices.fetch_prices(date(2026, 11, 18), "NO1")

    def test_to_rows_maps_api_fields_to_database_fields(self):
        rows = fetch_prices.to_rows([self.valid_record], "NO2")

        self.assertEqual(
            rows,
            [
                {
                    "power_price": 1.25,
                    "region": "NO2",
                    "time_start": "2026-11-18T00:00:00+01:00",
                    "time_end": "2026-11-18T01:00:00+01:00",
                }
            ],
        )

    @patch("fetch_prices.create_client")
    def test_upsert_uses_service_role_and_conflict_columns(self, create_client):
        rows = [{"region": "NO1", "time_start": "2026-11-18T00:00:00+01:00"}]
        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "https://example.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "test-service-role",
            },
        ):
            fetch_prices.upsert_prices(rows)

        create_client.assert_called_once_with(
            "https://example.supabase.co", "test-service-role"
        )
        client = create_client.return_value
        client.table.assert_called_once_with("power_prices")
        client.table.return_value.upsert.assert_called_once_with(
            rows, on_conflict="region,time_start"
        )
        client.table.return_value.upsert.return_value.execute.assert_called_once()

    @patch("fetch_prices.create_client")
    def test_upsert_fails_clearly_when_secrets_are_missing(self, create_client):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "SUPABASE_URL"):
                fetch_prices.upsert_prices([{"region": "NO1"}])

        create_client.assert_not_called()

    def test_upsert_rejects_empty_batches(self):
        with self.assertRaises(ValueError):
            fetch_prices.upsert_prices([])


if __name__ == "__main__":
    unittest.main()
