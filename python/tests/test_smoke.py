"""
Proves the generated client actually round-trips against a REAL running Storefront.Api instance - not a
mock. Requires Storefront.Api running at API_URL (dev default http://localhost:5135); skips with a clear
message if it isn't reachable, rather than failing CI for an unrelated reason.

We can't exercise a full authenticated business flow here (no seeded Store Access Key/tenant database is
available in every environment this runs in), so this proves what's reliably true everywhere instead: the
generated client sends a real HTTP request with a garbage X-Commerce-Key, the real API rejects it with the
documented RFC 9457 shape, and the generated types deserialize that shape correctly.

Run with: python -m unittest tests/test_smoke.py -v
Requires the generated client on the path - run generate.sh first (see ../README.md).
"""

import os
import sys
import unittest
import urllib.request
import urllib.error

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "generated"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from ordereazi_commerce_api import ApiClient, ApiException, CartApi, Configuration  # noqa: E402
from retry import build_retry  # noqa: E402

API_URL = os.environ.get("API_URL", "http://localhost:5135")


def _is_api_reachable() -> bool:
    try:
        with urllib.request.urlopen(f"{API_URL}/openapi/store.json", timeout=5) as response:
            return response.status == 200
    except Exception:
        return False


class SmokeTests(unittest.TestCase):
    def setUp(self):
        if not _is_api_reachable():
            self.skipTest(f"Storefront.Api not reachable at {API_URL} - nothing to test against here.")

    def test_invalid_key_returns_typed_problem_details(self):
        config = Configuration(host=API_URL)
        config.api_key["X-Commerce-Key"] = "invalid_test_key_xyz"

        with ApiClient(config) as client:
            cart_api = CartApi(client)

            with self.assertRaises(ApiException) as ctx:
                cart_api.cart_get_cart_api()

            error = ctx.exception
            self.assertEqual(error.status, 401)
            self.assertEqual(error.data.code, "store_key_invalid")
            self.assertTrue(error.data.trace_id)

    def test_retry_handler_attaches_cleanly_to_generated_client(self):
        # Doesn't need a specific response - just proves build_retry() composes with the generated
        # client's Configuration without throwing, i.e. it's a real, usable option, not just standalone code.
        config = Configuration(host=API_URL)
        config.api_key["X-Commerce-Key"] = "invalid_test_key_xyz"
        config.retries = build_retry()

        with ApiClient(config) as client:
            cart_api = CartApi(client)
            with self.assertRaises(ApiException) as ctx:
                cart_api.cart_get_cart_api()
            self.assertEqual(ctx.exception.status, 401)


if __name__ == "__main__":
    unittest.main()
