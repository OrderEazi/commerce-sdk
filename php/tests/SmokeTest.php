<?php

namespace OrderEazi\Commerce\Api\Sdk\Tests;

use GuzzleHttp\Client;
use GuzzleHttp\HandlerStack;
use OrderEazi\Commerce\Api\ApiException;
use OrderEazi\Commerce\Api\Api\CartApi;
use OrderEazi\Commerce\Api\Configuration;
use OrderEazi\Commerce\Api\Sdk\RetryMiddleware;
use PHPUnit\Framework\TestCase;

/**
 * Proves the generated client actually round-trips against a REAL running Storefront.Api instance - not a
 * mock. Requires Storefront.Api running at API_URL (dev default http://localhost:5135); skips with a clear
 * message if it isn't reachable, rather than failing CI for an unrelated reason.
 *
 * We can't exercise a full authenticated business flow here (no seeded Store Access Key/tenant database is
 * available in every environment this runs in), so this proves what's reliably true everywhere instead: the
 * generated client sends a real HTTP request with a garbage X-Commerce-Key, the real API rejects it with
 * the documented RFC 9457 shape, and the generated ApiException surfaces it correctly. Note this client
 * (default Guzzle http_errors) throws ApiException for the 401 rather than returning a typed
 * StoreProblemDetails object directly - getResponseBody() is the raw JSON string, so it's decoded by hand
 * here rather than relying on a deserialized model.
 */
final class SmokeTest extends TestCase
{
    private static function apiUrl(): string
    {
        return getenv('API_URL') ?: 'http://localhost:5135';
    }

    private static function isApiReachable(): bool
    {
        $context = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
        $result = @file_get_contents(self::apiUrl() . '/openapi/store.json', false, $context);
        return $result !== false;
    }

    protected function setUp(): void
    {
        if (!self::isApiReachable()) {
            $this->markTestSkipped('Storefront.Api not reachable at ' . self::apiUrl() . ' - nothing to test against here.');
        }
    }

    private function cartApi(?callable $configureStack = null): CartApi
    {
        $config = new Configuration();
        $config->setHost(self::apiUrl());
        $config->setApiKey('X-Commerce-Key', 'invalid_test_key_xyz');

        $stack = HandlerStack::create();
        if ($configureStack !== null) {
            $configureStack($stack);
        }
        $client = new Client(['handler' => $stack]);

        return new CartApi($client, $config);
    }

    public function testInvalidKeyReturnsTypedProblemDetails(): void
    {
        $thrown = null;
        try {
            $this->cartApi()->cartGetCartApi();
        } catch (ApiException $e) {
            $thrown = $e;
        }

        $this->assertNotNull($thrown, 'Expected an invalid X-Commerce-Key to raise an ApiException.');
        $this->assertSame(401, $thrown->getCode());

        $body = json_decode((string) $thrown->getResponseBody(), true);
        $this->assertSame('store_key_invalid', $body['code'] ?? null);
        $this->assertNotEmpty($body['traceId'] ?? null);
    }

    public function testRetryMiddlewareAttachesCleanlyToGeneratedClient(): void
    {
        // Doesn't assert on retry behavior itself (RetryMiddlewareTest already covers that against a mock
        // server) - just proves RetryMiddleware composes with the generated client's constructor without
        // throwing, i.e. it's a real, usable Guzzle middleware, not just standalone code.
        $thrown = null;
        try {
            $this->cartApi(function (HandlerStack $stack): void {
                $stack->push(RetryMiddleware::create());
            })->cartGetCartApi();
        } catch (ApiException $e) {
            $thrown = $e;
        }

        $this->assertNotNull($thrown);
        $this->assertSame(401, $thrown->getCode());
    }
}
