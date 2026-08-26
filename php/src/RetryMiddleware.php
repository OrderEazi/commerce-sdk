<?php

/**
 * Opt-in 429 retry/backoff for the generated client. See ../RETRY_POLICY.md for the full policy and why
 * it's safe to retry every HTTP method (including POST/PUT/DELETE) specifically for 429 - the API's rate
 * limiter runs before any handler, so a 429 guarantees the request was never processed.
 *
 * This is generated-code-independent - it's a plain Guzzle middleware with zero dependency on the
 * generated OrderEazi\Commerce\Api types, so it's never touched by regeneration. Attach it to a
 * HandlerStack and pass the resulting Client into any generated `*Api` constructor (client is the first
 * constructor argument):
 *
 *   $stack = \GuzzleHttp\HandlerStack::create();
 *   $stack->push(\OrderEazi\Commerce\Api\Sdk\RetryMiddleware::create());
 *   $client = new \GuzzleHttp\Client(['handler' => $stack]);
 *   $cartApi = new \OrderEazi\Commerce\Api\CartApi($client, $config);
 *
 * Must be pushed onto a stack that still has Guzzle's default 'http_errors' middleware present (true for
 * HandlerStack::create()'s default stack) - this middleware relies on seeing the raw response before
 * http_errors converts a non-2xx status into a thrown exception, which is exactly what happens when it's
 * pushed after the stack is created (later-pushed middleware sits closer to the handler, so it sees the
 * response first; http_errors, being outermost, only fires once retries are exhausted and the response is
 * passed through unchanged - surfacing as the normal ApiException(getCode() === 429, ...) callers expect).
 */

namespace OrderEazi\Commerce\Api\Sdk;

use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Middleware;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

final class RetryMiddleware
{
    /**
     * @param int   $maxRetries        Maximum number of retries after the initial attempt. Default 3 (4 total attempts).
     * @param float $baseDelaySeconds  Base delay used for the exponential-backoff fallback when no Retry-After header is present. Default 0.5s.
     * @param float $maxDelaySeconds   Upper bound for any single wait, regardless of what Retry-After or backoff computed. Default 30s.
     */
    public static function create(int $maxRetries = 3, float $baseDelaySeconds = 0.5, float $maxDelaySeconds = 30.0): callable
    {
        $decider = function (
            int $retries,
            RequestInterface $request,
            ?ResponseInterface $response = null,
            $exception = null
        ) use ($maxRetries): bool {
            if ($retries >= $maxRetries) {
                return false;
            }

            $status = self::statusOf($response, $exception);
            return $status === 429;
        };

        $delay = function (int $retries, ?ResponseInterface $response = null) use ($baseDelaySeconds, $maxDelaySeconds): float {
            if ($response !== null) {
                $retryAfter = $response->getHeaderLine('Retry-After');
                if ($retryAfter !== '') {
                    $seconds = self::parseRetryAfter($retryAfter);
                    if ($seconds !== null) {
                        return min($seconds, $maxDelaySeconds) * 1000;
                    }
                }
            }

            $backoffSeconds = $baseDelaySeconds * (2 ** $retries);
            $jitterSeconds = (mt_rand() / mt_getrandmax()) * $baseDelaySeconds;
            return min($backoffSeconds + $jitterSeconds, $maxDelaySeconds) * 1000;
        };

        return Middleware::retry($decider, $delay);
    }

    private static function statusOf(?ResponseInterface $response, $exception): ?int
    {
        if ($response !== null) {
            return $response->getStatusCode();
        }

        if ($exception instanceof RequestException && $exception->getResponse() !== null) {
            return $exception->getResponse()->getStatusCode();
        }

        return null;
    }

    private static function parseRetryAfter(string $value): ?float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return null;
        }

        return max(0, $timestamp - time());
    }
}
