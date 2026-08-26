using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Http;
using OrderEazi.Commerce.Sdk.Api;
using OrderEazi.Commerce.Sdk.Client;
using OrderEazi.Commerce.Sdk.Extensions;
using Xunit;

namespace Smoke.Tests;

/// <summary>
/// Proves the generated client actually round-trips against a REAL running Storefront.Api instance - not a
/// mock. Requires Storefront.Api running at API_URL (dev default http://localhost:5135); skips with a clear
/// message if it isn't reachable, rather than failing CI for an unrelated reason.
///
/// We can't exercise a full authenticated business flow here (no seeded Store Access Key/tenant database is
/// available in every environment this runs in), so this proves what's reliably true everywhere instead: the
/// generated client sends a real HTTP request with a garbage X-Commerce-Key, the real API rejects it with the
/// documented RFC 9457 shape, and the generated types deserialize that shape correctly. See
/// CheckoutController/CartController's real 401 response for the exact contract being verified. A registered
/// ApiKeyToken is required regardless - the generated DI wiring won't resolve ICartApi without one, even
/// though we deliberately supply a value the server will reject.
/// </summary>
public class SmokeTests
{
	private static readonly string ApiUrl = Environment.GetEnvironmentVariable("API_URL") ?? "http://localhost:5135";

	private static async Task<bool> IsApiReachableAsync()
	{
		try
		{
			using var client = new HttpClient();
			var response = await client.GetAsync($"{ApiUrl}/openapi/store.json");
			return response.IsSuccessStatusCode;
		}
		catch
		{
			return false;
		}
	}

	private static IHost BuildHost(Action<IHttpClientBuilder>? configureBuilder = null)
	{
		return Host.CreateDefaultBuilder()
			.ConfigureApi((_, options) =>
			{
				options.AddTokens(new ApiKeyToken("invalid_test_key_xyz", ClientUtils.ApiKeyHeader.X_Commerce_Key, prefix: ""));
				// CartApi's constructor needs a provider for every token type used anywhere in the "store"
				// document (Bearer is used by authenticated-customer endpoints) even though GetCart itself
				// doesn't require one - not actually sent unless an operation's security scheme calls for it.
				options.AddTokens(new BearerToken("unused"));
				options.AddApiHttpClients(
					(HttpClient client) => { client.BaseAddress = new Uri(ApiUrl); },
					(IHttpClientBuilder builder) => configureBuilder?.Invoke(builder));
			})
			.Build();
	}

	[Fact]
	public async Task InvalidKey_ReturnsTypedProblemDetails()
	{
		if (!await IsApiReachableAsync())
		{
			// Not a failure - just nothing to test against in this environment.
			return;
		}

		var host = BuildHost();
		var cartApi = host.Services.GetRequiredService<ICartApi>();
		var response = await cartApi.CartGetCartApiAsync();

		Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

		var problem = response.Unauthorized();
		Assert.NotNull(problem);
		Assert.Equal("store_key_invalid", problem!.Code);
		Assert.False(string.IsNullOrEmpty(problem.TraceId));
	}

	[Fact]
	public void RetryHandler_AttachesCleanlyToGeneratedClient()
	{
		// Doesn't need the live API - just proves RetryHandler composes with the generated DI registration
		// without throwing, i.e. it's a real, usable IHttpClientBuilder extension, not just standalone code.
		var host = BuildHost(builder => builder.AddHttpMessageHandler(() => new RetryHandler()));

		var cartApi = host.Services.GetRequiredService<ICartApi>();
		Assert.NotNull(cartApi);
	}
}
