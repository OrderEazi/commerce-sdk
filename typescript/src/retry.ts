/**
 * Opt-in 429 retry/backoff for the generated client. See ../../RETRY_POLICY.md for the full policy and why
 * it's safe to retry every HTTP method (including POST/PUT/DELETE) specifically for 429 - the API's rate
 * limiter runs before any handler, so a 429 guarantees the request was never processed.
 *
 * This wraps a plain axios instance with a response interceptor - it does NOT touch anything under
 * src/generated/, so it survives regeneration untouched. Pass the returned instance as the third constructor
 * argument to any generated `XxxApi` class (e.g. `new CartApi(config, basePath, createRetryingAxios())`).
 */
import axios, { type AxiosInstance, type AxiosError } from 'axios';

export interface RetryOptions {
	/** Maximum number of retries after the initial attempt. Default 3 (4 total attempts). */
	maxRetries?: number;
	/** Base delay in milliseconds used for the exponential-backoff fallback when no Retry-After header is present. Default 500. */
	baseDelayMs?: number;
	/** Upper bound in milliseconds for any single wait, regardless of what Retry-After or backoff computed. Default 30000. */
	maxDelayMs?: number;
}

const DEFAULTS: Required<RetryOptions> = {
	maxRetries: 3,
	baseDelayMs: 500,
	maxDelayMs: 30_000,
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function delayForAttempt(error: AxiosError, attempt: number, options: Required<RetryOptions>): number {
	const retryAfterHeader = error.response?.headers?.['retry-after'];
	if (retryAfterHeader !== undefined) {
		const seconds = Number(retryAfterHeader);
		if (!Number.isNaN(seconds) && seconds >= 0) {
			return Math.min(seconds * 1000, options.maxDelayMs);
		}
	}

	const backoff = options.baseDelayMs * 2 ** attempt;
	const jitter = Math.random() * options.baseDelayMs;
	return Math.min(backoff + jitter, options.maxDelayMs);
}

/**
 * Creates an axios instance that automatically retries on HTTP 429, honoring the `Retry-After` header when
 * present and falling back to exponential backoff with jitter otherwise. Every other status code (including
 * 5xx) passes through unchanged - see RETRY_POLICY.md for why 5xx isn't covered yet.
 */
export function createRetryingAxios(options: RetryOptions = {}): AxiosInstance {
	const resolved: Required<RetryOptions> = { ...DEFAULTS, ...options };
	const instance = axios.create();

	instance.interceptors.response.use(undefined, async (error: AxiosError) => {
		const config = error.config as (AxiosError['config'] & { __retryCount?: number }) | undefined;

		if (!config || error.response?.status !== 429) {
			return Promise.reject(error);
		}

		config.__retryCount = config.__retryCount ?? 0;
		if (config.__retryCount >= resolved.maxRetries) {
			return Promise.reject(error);
		}

		config.__retryCount += 1;
		await sleep(delayForAttempt(error, config.__retryCount, resolved));
		return instance.request(config);
	});

	return instance;
}
