# Retry/Backoff Policy

All four SDKs (TypeScript, Python, PHP, C#) are 100% generated from the OpenAPI spec - nothing in
`generated/` can carry hand-written retry logic, since it's overwritten on every regeneration. Each language
instead ships a small, hand-written wrapper living outside `generated/` (same pattern as `TypeScript/examples/`)
that a consumer opts into when constructing their client. Retry logic is never silently baked into the
generated code itself.

## Policy

- **Retries ONLY on HTTP 429** (Too Many Requests). Nothing else - a 400/401/403/404 is a client error retrying
  won't fix, and a 5xx is deliberately left to the caller for now (see "Not covered" below).
- **Delay**: if the response carries a `Retry-After` header (in seconds - the API always sends one on 429, see
  `Program.cs`'s `RateLimiter.OnRejected`), wait exactly that long. Otherwise fall back to exponential backoff
  with jitter: `baseDelayMs * 2^attempt + random(0, baseDelayMs)`.
- **Max attempts**: 3 retries by default (4 total attempts), configurable by the caller.
- **Safe for every HTTP method, including POST/PUT/DELETE** - this is the important part. The API's rate
  limiter (`Program.cs`) runs as the very first middleware, ahead of `StoreApiKeyMiddleware`,
  `DatabaseInitializationMiddleware`, and all controller/business logic. A 429 means the request was rejected
  at the gate and **never reached any handler** - nothing was read, validated, or mutated. Retrying it is not
  the same risk as retrying a request that failed mid-processing (a 5xx could mean partial work happened);
  a 429 guarantees zero work happened. This is why every SDK's wrapper retries all methods uniformly, with no
  idempotency-key gating needed specifically for the 429 case.

## Not covered (deliberately, for now)

- **5xx retries** - a transient `502`/`503`/`504` might warrant a retry too, but whether that's safe depends
  on whether the specific endpoint is idempotent (see `[Idempotent(...)]` on some Store actions), which the
  OpenAPI spec doesn't currently expose to a generated client. Adding this later would need either exposing
  idempotency as a spec-level extension, or scoping 5xx retries to `GET`/`HEAD` only (always safe) as a
  conservative first step.
- **Circuit breaking / connection-level retries** (DNS failures, connection resets) - left to whatever HTTP
  stack each language's generated client already uses (axios, urllib3, Guzzle, `HttpClient`), which typically
  have their own transport-level retry knobs already.

## Per-language implementation

| Language | File | Mechanism |
|---|---|---|
| TypeScript | `TypeScript/src/retry.ts` | Axios response interceptor |
| Python | `Python/src/retry.py` (`build_retry()`) | `urllib3.util.Retry` passed to the generated `Configuration.retries` |
| PHP | `PHP/src/RetryMiddleware.php` | Guzzle `HandlerStack` middleware |
| C# | `CSharp/src/RetryHandler.cs` | `DelegatingHandler` attached to the `HttpClient` passed into `Configuration` |

Each wrapper is opt-in and tested against a real local server (see each language's `tests/` folder) plus a
smoke test against a real running `Storefront.Api`. See each language's own README for the exact usage
snippet.

## Notable per-language findings (from building/testing these wrappers)

- **Python's default is NOT fully inert.** Unlike TypeScript/PHP/C#, a bare `urllib3.PoolManager()` (the
  generated client's default with no `retries` configured) already retries a 429-with-`Retry-After` a few
  times out of the box - urllib3 special-cases status codes 429/413/503 (`Retry.RETRY_AFTER_STATUS_CODES`)
  regardless of `status_forcelist`, using its implicit default budget of 3. This only applies to
  GET/HEAD/PUT/DELETE/OPTIONS/TRACE though - **not POST** (urllib3's default `allowed_methods` excludes it),
  and there's no backoff (instant retries) or `Retry-After` cap beyond the implicit total. `build_retry()`'s
  real value is covering POST too (safe here - see Policy above), adding real exponential backoff, and making
  the budget an explicit, documented number instead of urllib3's implicit default of 3. See
  `Python/tests/test_retry.py`'s `test_default_pool_manager_already_retries_get_but_not_post`.
- **PHP's generated `ApiException` doesn't carry a deserialized error body on the thrown path.** Guzzle's
  default `http_errors` middleware throws a `ClientException` (a `RequestException`) for any 4xx/5xx *before*
  the generated `*Api` class's own per-status-code switch (which maps 401/403/404/429/500 to
  `StoreProblemDetails`) ever runs - that switch only fires if `http_errors` is disabled, which nothing in
  this SDK does. So `ApiException::getResponseBody()` returns the raw JSON string, not a `StoreProblemDetails`
  instance; a caller needs `json_decode($e->getResponseBody(), true)` for now. See `PHP/tests/SmokeTest.php`.
- **C#'s systemic numeric-schema bug (fixed).** `Microsoft.AspNetCore.OpenApi`'s schema exporter represented
  every plain int/number property spec-wide as `{"type":["integer","string"],"pattern":"..."}` - a leniency
  artifact meant for binding numeric route/query values from strings, wrongly applied to body/response
  properties too. .NET's component deduplication collapsed all of these into one shared, oddly-named schema
  (`AccountBaseModelAccountId`), and the C# SDK's generated converter for that shared type threw on a plain
  JSON number - including `StoreProblemDetails.Status`, breaking every typed error response. Fixed spec-wide
  by `Storefront.Api/OpenApi/NumericSchemaTransformer.cs` (registered for every OpenAPI document), which
  strips the spurious `string` type back off. Caught by `CSharp/tests/Smoke.Tests` actually deserializing a
  real 401 response - no prior verification pass in this session had exercised real deserialization for the
  C# SDK specifically.
