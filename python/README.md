# OrderEazi Commerce API - Python SDK

Auto-generated Python client for the OrderEazi Commerce API (`Storefront.Api`), from its OpenAPI
specification via [openapi-generator](https://openapi-generator.tech)'s `python` template. Not hand-maintained
- regenerate it after the API changes rather than editing generated files directly.

## Generating the SDK

### Prerequisites

1. `Storefront.Api` running: `dotnet run --project src/Presentation/Storefront.Api` (dev default `http://localhost:5135`)
2. Node.js/npx available (used to run `openapi-generator-cli`; the generator itself is Java-based, so a JRE is also required)

### Generate

```bash
cd src/Tools/Storefront.Sdk/Python
bash generate.sh
```

This fetches the live OpenAPI spec from `${API_URL:-http://localhost:5135}/openapi/${OPENAPI_DOC:-store}.json`
and generates a full Python package under `generated/`.

Override the target API or document:

```bash
API_URL=https://api.example.com OPENAPI_DOC=store bash generate.sh
```

## Installation

Once generated, install the package locally:

```bash
cd generated
pip install .
```

Or, to install directly from a built wheel/sdist once you publish one (e.g. to a private PyPI index or
artifact store):

```bash
pip install ordereazi-commerce-sdk
```

## Usage

The generator produces a `Configuration`/`ApiClient` pair plus one `XxxApi` class per resource (named from
the API's OpenAPI tags):

```python
import ordereazi_commerce_api
from ordereazi_commerce_api.rest import ApiException

configuration = ordereazi_commerce_api.Configuration(
    host="https://api.example.com"
)
# Store Access Key (pk_store_.../sk_store_...) is required on every request
configuration.api_key['X-Commerce-Key'] = 'pk_store_...'

with ordereazi_commerce_api.ApiClient(configuration) as api_client:
    auth_api = ordereazi_commerce_api.AuthApi(api_client)
    login_response = auth_api.login({"email": "user@example.com", "password": "password"})

    # JWT bearer token for authenticated endpoints, once logged in
    configuration.access_token = login_response.token

    cart_api = ordereazi_commerce_api.CartApi(api_client)
    cart = cart_api.get_cart()

    try:
        cart_api.add_item({"productId": 123, "qty": 1})
    except ApiException as e:
        print(f"Add to cart failed: {e}")

    search_api = ordereazi_commerce_api.SearchApi(api_client)
    results = search_api.get_products(keywords="laptop", page=1, limit=20)
```

Exact class/method names are generated from the spec, so they'll shift as `Storefront.Api`'s `store` OpenAPI
document evolves - the shape above is representative of the current API surface (auth, catalog/search, cart,
checkout, orders, profile, wishlists, gift registries, etc.).

## Retry / backoff on 429

The generated client's `Configuration.retries` accepts a plain int or a full `urllib3.util.retry.Retry`
instance - by default it's unset, so no retrying happens. `src/retry.py`'s `build_retry()` builds one scoped
to our policy (429 only, honors `Retry-After`, exponential backoff otherwise) - see
[../RETRY_POLICY.md](../RETRY_POLICY.md) for the full policy and why it's safe to retry every HTTP method:

```python
import sys
sys.path.insert(0, "path/to/Storefront.Sdk/Python/src")
from retry import build_retry

configuration = ordereazi_commerce_api.Configuration(host="https://api.example.com")
configuration.retries = build_retry(max_retries=3)
```

Worth knowing: unlike the other three SDKs, a bare `Configuration` (no `retries` set) already retries a
429-with-`Retry-After` a few times on GET/HEAD/PUT/DELETE/OPTIONS/TRACE - urllib3 special-cases those status
codes regardless of configuration. It does NOT cover POST, has no real backoff (instant retries), and the
budget isn't explicit - see RETRY_POLICY.md's "Notable per-language findings" for detail. `build_retry()`
closes that gap.

## Testing

`tests/test_retry.py` verifies `build_retry()` against a real local HTTP server (stdlib `http.server`, no
mocking library). `tests/test_smoke.py` verifies the generated client against a real running
`Storefront.Api` (skips if unreachable):

```bash
cd src/Tools/Storefront.Sdk/Python
python -m venv .venv && .venv/bin/pip install -e ./generated   # generate.sh first if generated/ doesn't exist yet
.venv/bin/python -m unittest tests.test_retry -v
API_URL=http://localhost:5135 .venv/bin/python -m unittest tests.test_smoke -v
```

## Regenerating

Re-run `bash generate.sh` any time `Storefront.Api`'s `store` OpenAPI document changes. `generated/` is
gitignored - it's never committed, always produced fresh from the live spec.
