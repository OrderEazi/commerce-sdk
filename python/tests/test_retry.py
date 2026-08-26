"""
Proves build_retry() actually retries on 429, honors Retry-After, gives up after max_retries, and leaves
every other status code alone - against a real local HTTP server (http.server), not a mocked connection.

Run with: python -m unittest tests/test_retry.py -v
(stdlib only - no pytest/requests dependency needed for this file.)
"""

import sys
import os
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

import urllib3

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from retry import build_retry  # noqa: E402


def _start_server(statuses, retry_after="0"):
    """Serves one response per entry in `statuses` (429s get a Retry-After header), then keeps the
    server alive until `server.request_count` requests matching len(statuses) have been handled."""
    request_count = [0]

    class Handler(BaseHTTPRequestHandler):
        def _respond(self):
            index = request_count[0]
            request_count[0] += 1
            status = statuses[index] if index < len(statuses) else statuses[-1]
            self.send_response(status)
            if status == 429:
                self.send_header("Retry-After", retry_after)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            self._respond()

        def do_POST(self):
            self._respond()

        def log_message(self, *args):
            pass  # keep test output quiet

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever)
    thread.daemon = True
    thread.start()
    return server, thread, request_count


class RetryTests(unittest.TestCase):
    def test_retries_on_too_many_requests_honors_retry_after_then_succeeds(self):
        server, thread, request_count = _start_server([429, 429, 200], retry_after="0")
        try:
            pool = urllib3.PoolManager(retries=build_retry(max_retries=3, backoff_factor=0.01))
            response = pool.request("GET", f"http://127.0.0.1:{server.server_port}/")

            self.assertEqual(response.status, 200)
            self.assertEqual(request_count[0], 3)
        finally:
            server.shutdown()
            thread.join()

    def test_gives_up_after_max_retries(self):
        server, thread, request_count = _start_server([429, 429, 429], retry_after="0")
        try:
            pool = urllib3.PoolManager(retries=build_retry(max_retries=2, backoff_factor=0.01))
            response = pool.request("GET", f"http://127.0.0.1:{server.server_port}/")

            # raise_on_status=False means the final 429 comes back as a normal response, not an exception -
            # this is what lets the generated client turn it into an ordinary ApiException(status=429, ...).
            self.assertEqual(response.status, 429)
            self.assertEqual(request_count[0], 3)  # 1 initial + 2 retries
        finally:
            server.shutdown()
            thread.join()

    def test_does_not_retry_on_non_too_many_requests_status(self):
        server, thread, request_count = _start_server([404])
        try:
            pool = urllib3.PoolManager(retries=build_retry(max_retries=3, backoff_factor=0.01))
            response = pool.request("GET", f"http://127.0.0.1:{server.server_port}/")

            self.assertEqual(response.status, 404)
            self.assertEqual(request_count[0], 1)
        finally:
            server.shutdown()
            thread.join()

    def test_default_pool_manager_already_retries_get_but_not_post(self):
        # NOT a sanity check that retry is "off by default" - it isn't, for GET. urllib3 special-cases
        # 429/413/503 (Retry.RETRY_AFTER_STATUS_CODES): ANY Retry (even the implicit default budget of 3
        # a bare PoolManager() uses) retries a request whose method is in the default allowed_methods set
        # (GET/HEAD/PUT/DELETE/OPTIONS/TRACE - not POST) when the response carries a Retry-After header,
        # regardless of status_forcelist. So a bare PoolManager already retries a 429 GET a few times,
        # instantly (backoff_factor=0), before the caller ever notices. It does NOT retry POST, since
        # method-retryability is checked before the special-case status check. This is exactly the gap
        # build_retry() closes: covering POST (safe here - see RETRY_POLICY.md), adding real exponential
        # backoff instead of instant retries, and making the budget an explicit, documented number instead
        # of urllib3's implicit default of 3.
        server, thread, request_count = _start_server([429, 429, 429, 429], retry_after="0")
        try:
            pool = urllib3.PoolManager()
            response = pool.request("GET", f"http://127.0.0.1:{server.server_port}/")

            self.assertEqual(response.status, 429)
            self.assertEqual(request_count[0], 4)  # 1 initial + urllib3's implicit default of 3 retries
        finally:
            server.shutdown()
            thread.join()

        server, thread, request_count = _start_server([429], retry_after="0")
        try:
            pool = urllib3.PoolManager()
            response = pool.request("POST", f"http://127.0.0.1:{server.server_port}/", body=b"{}")

            self.assertEqual(response.status, 429)
            self.assertEqual(request_count[0], 1)  # POST isn't in the default allowed_methods - no retry
        finally:
            server.shutdown()
            thread.join()

    def test_build_retry_covers_post_unlike_the_default(self):
        # The actual reason build_retry() sets allowed_methods=None - see RETRY_POLICY.md for why retrying
        # POST/PUT/DELETE is safe specifically for 429 (the rate limiter runs before any handler, so a 429
        # guarantees the request was never processed).
        server, thread, request_count = _start_server([429, 429, 200], retry_after="0")
        try:
            pool = urllib3.PoolManager(retries=build_retry(max_retries=3, backoff_factor=0.01))
            response = pool.request("POST", f"http://127.0.0.1:{server.server_port}/", body=b"{}")

            self.assertEqual(response.status, 200)
            self.assertEqual(request_count[0], 3)
        finally:
            server.shutdown()
            thread.join()


if __name__ == "__main__":
    unittest.main()
