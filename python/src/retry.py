# Opt-in 429 retry/backoff for the generated client. See ../RETRY_POLICY.md for the full policy and why
# it's safe to retry every HTTP method (including POST/PUT/DELETE) specifically for 429 - the API's rate
# limiter runs before any handler, so a 429 guarantees the request was never processed.
#
# Unlike the TypeScript/C# SDKs, no hand-written retry loop is needed here: urllib3's Retry already
# understands Retry-After (respect_retry_after_header) and exponential backoff (backoff_factor/backoff_max)
# natively. This is just a small, policy-scoped factory around it. Attach the result to the generated
# client's Configuration before constructing an ApiClient:
#
#   from ordereazi_commerce_api import Configuration
#   from retry import build_retry
#
#   config = Configuration(host="https://api.example.com")
#   config.retries = build_retry()

from urllib3.util.retry import Retry


def build_retry(max_retries: int = 3, backoff_factor: float = 0.5, max_backoff: float = 30.0) -> Retry:
    """Builds a Retry that retries ONLY on 429, honoring Retry-After when present and falling back to
    exponential backoff (backoff_factor * 2**(attempt-1), capped at max_backoff) otherwise.

    connect/read/redirect/other are explicitly zeroed so a connection-level failure is never retried by
    this policy - only 429 is, matching the TypeScript/C# SDKs exactly. raise_on_status=False so that
    exhausting max_retries surfaces the final 429 as a normal ApiException(status=429, ...) instead of
    urllib3 raising its own MaxRetryError.
    """
    return Retry(
        total=max_retries,
        status=max_retries,
        connect=0,
        read=0,
        redirect=0,
        other=0,
        status_forcelist=[429],
        allowed_methods=None,
        backoff_factor=backoff_factor,
        backoff_max=max_backoff,
        respect_retry_after_header=True,
        raise_on_status=False,
    )
