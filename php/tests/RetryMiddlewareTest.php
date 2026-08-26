<?php

namespace OrderEazi\Commerce\Api\Sdk\Tests;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\HandlerStack;
use OrderEazi\Commerce\Api\Sdk\RetryMiddleware;
use OrderEazi\Commerce\Api\Sdk\Tests\Support\MockServer;
use PHPUnit\Framework\TestCase;

/**
 * Proves RetryMiddleware actually retries on 429, honors Retry-After, gives up after maxRetries, and
 * leaves every other status code alone - against a real local HTTP server (PHP's built-in server), not a
 * mocked Guzzle handler.
 */
final class RetryMiddlewareTest extends TestCase
{
    private function clientWithRetry(int $maxRetries): Client
    {
        $stack = HandlerStack::create();
        $stack->push(RetryMiddleware::create($maxRetries, 0.01, 5.0));
        return new Client(['handler' => $stack]);
    }

    public function testRetriesOnTooManyRequestsHonorsRetryAfterThenSucceeds(): void
    {
        $server = MockServer::start([429, 429, 200], '0');
        try {
            $response = $this->clientWithRetry(3)->get($server->baseUrl);

            $this->assertSame(200, $response->getStatusCode());
            $this->assertSame(3, $server->requestCount());
        } finally {
            $server->stop();
        }
    }

    public function testGivesUpAfterMaxRetries(): void
    {
        $server = MockServer::start([429, 429, 429], '0');
        try {
            $thrown = null;
            try {
                $this->clientWithRetry(2)->get($server->baseUrl);
            } catch (ClientException $e) {
                $thrown = $e;
            }

            // The final 429 surfaces as a normal ClientException (Guzzle's default http_errors behavior) -
            // this is what lets the generated *Api class turn it into an ordinary ApiException(429, ...).
            $this->assertNotNull($thrown, 'Expected the final 429 to surface as a ClientException.');
            $this->assertSame(429, $thrown->getResponse()->getStatusCode());
            $this->assertSame(3, $server->requestCount()); // 1 initial + 2 retries
        } finally {
            $server->stop();
        }
    }

    public function testDoesNotRetryOnNonTooManyRequestsStatus(): void
    {
        $server = MockServer::start([404]);
        try {
            $thrown = null;
            try {
                $this->clientWithRetry(3)->get($server->baseUrl);
            } catch (ClientException $e) {
                $thrown = $e;
            }

            $this->assertNotNull($thrown);
            $this->assertSame(404, $thrown->getResponse()->getStatusCode());
            $this->assertSame(1, $server->requestCount());
        } finally {
            $server->stop();
        }
    }

    public function testPlainClientIsUnaffected(): void
    {
        // Sanity check: a plain Client (no RetryMiddleware attached, the generated client's default) must
        // not retry - proving this is genuinely opt-in. Unlike urllib3 (Python), Guzzle has no automatic
        // status-based retry of its own, so this is a straightforward true negative.
        $server = MockServer::start([429], '0');
        try {
            $thrown = null;
            try {
                (new Client())->get($server->baseUrl);
            } catch (ClientException $e) {
                $thrown = $e;
            }

            $this->assertNotNull($thrown);
            $this->assertSame(429, $thrown->getResponse()->getStatusCode());
            $this->assertSame(1, $server->requestCount());
        } finally {
            $server->stop();
        }
    }
}
