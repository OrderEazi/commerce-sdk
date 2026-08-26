// Opt-in 429 retry/backoff for the generated client. See ../../RETRY_POLICY.md for the full policy and why
// it's safe to retry every HTTP method (including POST/PUT/DELETE) specifically for 429 - the API's rate
// limiter runs before any handler, so a 429 guarantees the request was never processed.
//
// This is generated-code-independent - it's a plain DelegatingHandler with zero dependency on
// OrderEazi.Commerce.Sdk's generated types, so it's never touched by regeneration. Copy this file into
// your own project (or reference it directly if you're in the same repo), then attach it to the HttpClient
// you pass into any generated `XxxApi` constructor:
//
//   var httpClient = new HttpClient(new RetryHandler(new HttpClientHandler()));
//   var cartApi = new CartApi(logger, httpClient, jsonOptions, events, "https://api.example.com");

using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace OrderEazi.Commerce.Sdk.Extensions;

public sealed class RetryHandlerOptions
{
	/// <summary>Maximum number of retries after the initial attempt. Default 3 (4 total attempts).</summary>
	public int MaxRetries { get; init; } = 3;

	/// <summary>Base delay used for the exponential-backoff fallback when no Retry-After header is present. Default 500ms.</summary>
	public TimeSpan BaseDelay { get; init; } = TimeSpan.FromMilliseconds(500);

	/// <summary>Upper bound for any single wait, regardless of what Retry-After or backoff computed. Default 30s.</summary>
	public TimeSpan MaxDelay { get; init; } = TimeSpan.FromSeconds(30);
}

/// <summary>
/// Retries a request when the server responds with 429 (Too Many Requests), honoring the Retry-After header
/// when present and falling back to exponential backoff with jitter otherwise. Every other status code
/// (including 5xx) passes through unchanged.
/// </summary>
public sealed class RetryHandler : DelegatingHandler
{
	private readonly RetryHandlerOptions _options;
	private readonly Random _random = new();

	/// <summary>
	/// For DI/IHttpClientFactory registration - e.g. <c>builder.AddHttpMessageHandler(() => new RetryHandler())</c>.
	/// Leaves InnerHandler unset; the factory's pipeline builder chains it in automatically. Passing an
	/// already-set InnerHandler here would make HttpMessageHandlerBuilder.Build() throw.
	/// </summary>
	public RetryHandler(RetryHandlerOptions? options = null)
	{
		_options = options ?? new RetryHandlerOptions();
	}

	/// <summary>For manual/standalone construction - e.g. <c>new HttpClient(new RetryHandler(new HttpClientHandler()))</c>.</summary>
	public RetryHandler(HttpMessageHandler innerHandler, RetryHandlerOptions? options = null) : base(innerHandler)
	{
		_options = options ?? new RetryHandlerOptions();
	}

	protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
	{
		var attempt = 0;

		while (true)
		{
			var requestClone = attempt == 0 ? request : await CloneAsync(request, cancellationToken);
			var response = await base.SendAsync(requestClone, cancellationToken);

			if (response.StatusCode != (HttpStatusCode)429 || attempt >= _options.MaxRetries)
				return response;

			attempt++;
			var delay = DelayForAttempt(response, attempt);
			response.Dispose();
			await Task.Delay(delay, cancellationToken);
		}
	}

	private TimeSpan DelayForAttempt(HttpResponseMessage response, int attempt)
	{
		if (response.Headers.RetryAfter?.Delta is { } delta)
			return Min(delta, _options.MaxDelay);

		if (response.Headers.RetryAfter?.Date is { } date)
		{
			var untilDate = date - DateTimeOffset.UtcNow;
			if (untilDate > TimeSpan.Zero)
				return Min(untilDate, _options.MaxDelay);
		}

		var backoffMs = _options.BaseDelay.TotalMilliseconds * Math.Pow(2, attempt);
		var jitterMs = _random.NextDouble() * _options.BaseDelay.TotalMilliseconds;
		return Min(TimeSpan.FromMilliseconds(backoffMs + jitterMs), _options.MaxDelay);
	}

	private static TimeSpan Min(TimeSpan a, TimeSpan b) => a < b ? a : b;

	// HttpRequestMessage can only be sent once - a retried attempt needs its own clone (headers + content).
	private static async Task<HttpRequestMessage> CloneAsync(HttpRequestMessage request, CancellationToken cancellationToken)
	{
		var clone = new HttpRequestMessage(request.Method, request.RequestUri) { Version = request.Version };

		foreach (var header in request.Headers)
			clone.Headers.TryAddWithoutValidation(header.Key, header.Value);

		if (request.Content is not null)
		{
			var buffer = await request.Content.ReadAsByteArrayAsync(cancellationToken);
			var contentClone = new ByteArrayContent(buffer);
			foreach (var header in request.Content.Headers)
				contentClone.Headers.TryAddWithoutValidation(header.Key, header.Value);
			clone.Content = contentClone;
		}

		return clone;
	}
}
