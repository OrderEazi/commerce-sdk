# OrderEazi Commerce API - PHP SDK

Auto-generated PHP client for the OrderEazi Commerce API (`Storefront.Api`), from its OpenAPI
specification via [openapi-generator](https://openapi-generator.tech)'s `php` template. Not hand-maintained -
regenerate it after the API changes rather than editing generated files directly.

## Generating the SDK

### Prerequisites

1. `Storefront.Api` running: `dotnet run --project src/Presentation/Storefront.Api` (dev default `http://localhost:5135`)
2. Node.js/npx available (used to run `openapi-generator-cli`; the generator itself is Java-based, so a JRE is also required)
3. [Composer](https://getcomposer.org/) and PHP 8+ to install/use the generated package

### Generate

```bash
cd src/Tools/Storefront.Sdk/PHP
bash generate.sh
```

This fetches the live OpenAPI spec from `${API_URL:-http://localhost:5135}/openapi/${OPENAPI_DOC:-store}.json`
and generates a full Composer package under `generated/`.

Override the target API or document:

```bash
API_URL=https://api.example.com OPENAPI_DOC=store bash generate.sh
```

## Installation

Once generated, install the package locally:

```bash
cd generated
composer install
```

Or, to install directly once you publish it (e.g. to Packagist or a private Composer repository):

```bash
composer require ordereazi/commerce-sdk
```

## Usage

The generator produces a `Configuration`/`ApiClient` pair plus one `XxxApi` class per resource (named from
the API's OpenAPI tags), all under the `OrderEazi\Commerce\Api` namespace:

```php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use OrderEazi\Commerce\Api\Configuration;
use OrderEazi\Commerce\Api\ApiException;
use OrderEazi\Commerce\Api\Api\AuthApi;
use OrderEazi\Commerce\Api\Api\CartApi;
use OrderEazi\Commerce\Api\Api\SearchApi;

$config = Configuration::getDefaultConfiguration()
    ->setHost('https://api.example.com')
    // Store Access Key (pk_store_.../sk_store_...) is required on every request
    ->setApiKey('X-Commerce-Key', 'pk_store_...');

$authApi = new AuthApi(null, $config);
$loginResponse = $authApi->authLoginApi(['email' => 'user@example.com', 'password' => 'password']);

// JWT bearer token for authenticated endpoints, once logged in
$config->setAccessToken($loginResponse->getToken());

$cartApi = new CartApi(null, $config);
$cart = $cartApi->cartGetCartApi();

try {
    $cartApi->cartAddItemApi(['productId' => 123, 'qty' => 1]);
} catch (ApiException $e) {
    // Every failure follows the RFC 9457 Problem Details shape - see StoreProblemDetailsModel
    echo 'Add to cart failed: ' . $e->getResponseBody() . "\n";
}

$searchApi = new SearchApi(null, $config);
$results = $searchApi->searchGetProductsApi('laptop', 1, 20);
```

Exact class/method names are generated from the spec, so they'll shift as `Storefront.Api`'s `store` OpenAPI
document evolves - the shape above is representative of the current API surface (auth, catalog/search, cart,
checkout, orders, profile, wishlists, gift registries, etc.).

## Retry / backoff on 429

The generated client (plain Guzzle `Client`) doesn't retry anything by default. `src/RetryMiddleware.php`'s
`RetryMiddleware::create()` builds a Guzzle `HandlerStack` middleware that retries only on 429, honoring
`Retry-After` when present and falling back to exponential backoff with jitter otherwise - see
[../RETRY_POLICY.md](../RETRY_POLICY.md) for the full policy and why it's safe to retry every HTTP method:

```php
use GuzzleHttp\Client;
use GuzzleHttp\HandlerStack;
use OrderEazi\Commerce\Api\Sdk\RetryMiddleware;

$stack = HandlerStack::create();
$stack->push(RetryMiddleware::create(3));
$client = new Client(['handler' => $stack]);

$cartApi = new CartApi($client, $config);
```

Worth knowing: because Guzzle's default `http_errors` middleware throws for any 4xx/5xx before the generated
`*Api` class's per-status-code switch runs, a caught `ApiException`'s `getResponseBody()` returns the raw
JSON string, not a deserialized `StoreProblemDetails` object - `json_decode($e->getResponseBody(), true)` it
by hand. See RETRY_POLICY.md's "Notable per-language findings" for detail.

## Testing

This directory has its own `composer.json` (separate from `generated/composer.json`) for the hand-written
retry middleware and its tests - it depends on the generated package via a local Composer path repository,
so no publishing is needed first:

```bash
cd src/Tools/Storefront.Sdk/PHP
bash generate.sh          # if generated/ doesn't exist yet
composer install
vendor/bin/phpunit tests/RetryMiddlewareTest.php   # real local HTTP server, no running API needed
API_URL=http://localhost:5135 vendor/bin/phpunit tests/SmokeTest.php
```

## Regenerating

Re-run `bash generate.sh` any time `Storefront.Api`'s `store` OpenAPI document changes. `generated/` is
gitignored - it's never committed, always produced fresh from the live spec.
