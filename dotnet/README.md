# OrderEazi Commerce Headless API - C# SDK

Auto-generated C# client for the OrderEazi Commerce Headless API (`Storefront.Api`), from its OpenAPI specification
via [openapi-generator](https://openapi-generator.tech)'s `csharp` template. Not hand-maintained - regenerate
it after the API changes rather than editing generated files directly.

## Generating the SDK

### Prerequisites

1. `Storefront.Api` running: `dotnet run --project src/Presentation/Storefront.Api` (dev default `http://localhost:5135`)
2. Node.js/npx available (used to run `openapi-generator-cli`; the generator itself is Java-based, so a JRE is also required)
3. .NET 8 SDK or later

### Generate

```bash
cd src/Tools/Storefront.Sdk/CSharp
bash generate.sh
```

This fetches the live OpenAPI spec from `${API_URL:-http://localhost:5135}/openapi/${OPENAPI_DOC:-store}.json`
and generates a full project under `generated/src/OrderEazi.Commerce.Sdk/`.

Override the target API or document:

```bash
API_URL=https://api.example.com OPENAPI_DOC=store bash generate.sh
```

**Note on generator version**: pinned to `7.24.0` in `openapitools.json`, not `7.17.0` like the other three
SDKs. The `csharp` template in `7.17.0` has a bug generating free-form dictionary properties (e.g.
`ProductModel.KeyValues`) combined with nullable wrapping - it emits an invalid `Null<K,V>` type that doesn't
compile. `7.24.0` generates that shape correctly.

## Installation

Once generated, build and pack it locally:

```bash
cd generated/src/OrderEazi.Commerce.Sdk
dotnet pack -c Release
```

Or, to install directly once you publish it (e.g. to nuget.org or a private feed):

```bash
dotnet add package OrderEazi.Commerce.Sdk
```

## Usage

The generator produces a `Configuration`/`ApiClient` pair plus one `XxxApi` class per resource (named from
the API's OpenAPI tags), all under the `OrderEazi.Commerce.Sdk` namespace. Each call returns a strongly
typed response object exposing one accessor per possible status code (`.Ok()`, `.BadRequest()`, etc.):

```csharp
using OrderEazi.Commerce.Sdk.Client;
using OrderEazi.Commerce.Sdk.Api;

var config = new Configuration
{
    BasePath = "https://api.example.com",
};
// Store Access Key (pk_store_.../sk_store_...) is required on every request
config.AddApiKey("X-Commerce-Key", "pk_store_...");

var authApi = new AuthApi(config);
var loginResponse = await authApi.AuthLoginApiAsync(new LoginRequest { Email = "user@example.com", Password = "password" });

// JWT bearer token for authenticated endpoints, once logged in
config.AccessToken = loginResponse.Ok().Token;

var cartApi = new CartApi(config);
var cartResponse = await cartApi.CartGetCartApiAsync();
var cart = cartResponse.Ok();

try
{
    await cartApi.CartAddItemApiAsync(new AddToCartRequest { ProductId = 123, Qty = 1 });
}
catch (ApiException e)
{
    // Every failure follows the RFC 9457 Problem Details shape - see StoreProblemDetailsModel/StoreProblemDetails
    Console.WriteLine($"Add to cart failed: {e.Message}");
}

var searchApi = new SearchApi(config);
var results = (await searchApi.SearchGetProductsApiAsync(keywords: "laptop", page: 1, limit: 20)).Ok();
```

Exact class/method names are generated from the spec, so they'll shift as `Storefront.Api`'s `store` OpenAPI
document evolves - the shape above is representative of the current API surface (auth, catalog/search, cart,
checkout, orders, profile, wishlists, gift registries, etc.).

## Retry / backoff on 429

The generated client ships its own `AddRetryPolicy()`/`AddTimeoutPolicy()`/`AddCircuitBreakerPolicy()` Polly
extensions, but `AddRetryPolicy()` only covers transient 5xx/408 (`HandlePolicyExtensions.HandleTransientHttpError()`) -
explicitly not 429 - and retries with no delay/backoff at all. `src/RetryHandler.cs` is a standalone
`DelegatingHandler` that fills that gap: retries only on 429, honors `Retry-After` when present, falls back
to exponential backoff with jitter otherwise - see [../RETRY_POLICY.md](../RETRY_POLICY.md) for the full
policy and why it's safe to retry every HTTP method. Copy the file into your own project (it has zero
dependency on the generated types) and attach it via `IHttpClientBuilder`:

```csharp
services.ConfigureApi((_, options) =>
{
    options.AddApiHttpClients(
        client => client.BaseAddress = new Uri("https://api.example.com"),
        builder => builder.AddHttpMessageHandler(() => new RetryHandler()));
});
```

Or attach it directly to a manually-constructed `HttpClient`:

```csharp
var httpClient = new HttpClient(new RetryHandler(new HttpClientHandler()));
var cartApi = new CartApi(logger, httpClient, jsonOptions, events, "https://api.example.com");
```

## Testing

`tests/RetryHandler.Tests` verifies `RetryHandler` against a real local HTTP server (`HttpListener`, no
mocking library). `tests/Smoke.Tests` verifies the generated client against a real running `Storefront.Api`
(skips if unreachable):

```bash
cd src/Tools/Storefront.Sdk/CSharp
bash generate.sh          # if generated/ doesn't exist yet - Smoke.Tests references it directly
dotnet test tests/RetryHandler.Tests
API_URL=http://localhost:5135 dotnet test tests/Smoke.Tests
```

## Regenerating

Re-run `bash generate.sh` any time `Storefront.Api`'s `store` OpenAPI document changes. `generated/` is
gitignored - it's never committed, always produced fresh from the live spec.
