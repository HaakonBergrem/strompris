import unittest
from datetime import date, timedelta
from unittest.mock import patch

from fetch_last_30_days import get_last_30_days, upsert_in_batches


class BackfillTests(unittest.TestCase):
    def test_get_last_30_days_includes_today_and_start_date(self):
        days = get_last_30_days(date(2026, 11, 18))

        self.assertEqual(len(days), 30)
        self.assertEqual(days[0], date(2026, 10, 20))
        self.assertEqual(days[-1], date(2026, 11, 18))
        self.assertTrue(
            all(
                days[index + 1] - days[index] == timedelta(days=1)
                for index in range(len(days) - 1)
            )
        )

    @patch("fetch_last_30_days.upsert_prices")
    def test_upsert_in_batches_preserves_rows_and_limits_batch_size(self, upsert):
        rows = [{"id": index} for index in range(1201)]

        upsert_in_batches(rows)

        batches = [call.args[0] for call in upsert.call_args_list]
        self.assertEqual([len(batch) for batch in batches], [500, 500, 201])
        self.assertEqual([row for batch in batches for row in batch], rows)

    @patch("fetch_last_30_days.upsert_prices")
    def test_upsert_in_batches_rejects_non_positive_batch_size(self, upsert):
        with self.assertRaises(ValueError):
            upsert_in_batches([{"id": 1}], batch_size=0)

        upsert.assert_not_called()


if __name__ == "__main__":
    unittest.main()
