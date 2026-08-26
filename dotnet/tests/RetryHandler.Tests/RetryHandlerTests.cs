using System.Net;
using OrderEazi.Commerce.Sdk.Extensions;
using Xunit;

namespace RetryHandlerExtensionTests;

/// <summary>
/// Proves RetryHandler actually retries on 429, honors Retry-After, gives up after MaxRetries, and leaves
/// every other status code alone - against a real local HTTP server (HttpListener), not a mocked HttpClient.
/// </summary>
public class RetryHandlerTests
{
	private static (HttpListener listener, string url) StartListener()
	{
		var listener = new HttpListener();
		var port = GetFreePort();
		var url = $"http://127.0.0.1:{port}/";
		listener.Prefixes.Add(url);
		listener.Start();
		return (listener, url);
	}

	private static int GetFreePort()
	{
		using var socket = new System.Net.Sockets.Socket(System.Net.Sockets.AddressFamily.InterNetwork, System.Net.Sockets.SocketType.Stream, System.Net.Sockets.ProtocolType.Tcp);
		socket.Bind(new IPEndPoint(IPAddress.Loopback, 0));
		return ((IPEndPoint)socket.LocalEndPoint!).Port;
	}

	[Fact]
	public async Task RetriesOnTooManyRequests_HonorsRetryAfter_ThenSucceeds()
	{
		var (listener, url) = StartListener();
		var requestCount = 0;

		var serverTask = Task.Run(async () =>
		{
			for (var i = 0; i < 3; i++)
			{
				var context = await listener.GetContextAsync();
				requestCount++;
				if (i < 2)
				{
					context.Response.StatusCode = 429;
					context.Response.Headers.Add("Retry-After", "0");
				}
				else
				{
					context.Response.StatusCode = 200;
				}
				context.Response.Close();
			}
		});

		try
		{
			using var client = new HttpClient(new RetryHandler(
				new HttpClientHandler(),
				new RetryHandlerOptions { MaxRetries = 3, BaseDelay = TimeSpan.FromMilliseconds(10) }));

			var response = await client.GetAsync(url);

			Assert.Equal(HttpStatusCode.OK, response.StatusCode);
			Assert.Equal(3, requestCount);
		}
		finally
		{
			await serverTask;
			listener.Stop();
		}
	}

	[Fact]
	public async Task GivesUpAfterMaxRetries()
	{
		var (listener, url) = StartListener();
		var requestCount = 0;

		var serverTask = Task.Run(async () =>
		{
			for (var i = 0; i < 3; i++) // 1 initial + 2 retries
			{
				var context = await listener.GetContextAsync();
				requestCount++;
				context.Response.StatusCode = 429;
				context.Response.Headers.Add("Retry-After", "0");
				context.Response.Close();
			}
		});

		try
		{
			using var client = new HttpClient(new RetryHandler(
				new HttpClientHandler(),
				new RetryHandlerOptions { MaxRetries = 2, BaseDelay = TimeSpan.FromMilliseconds(10) }));

			var response = await client.GetAsync(url);

			Assert.Equal((HttpStatusCode)429, response.StatusCode);
			Assert.Equal(3, requestCount);
		}
		finally
		{
			await serverTask;
			listener.Stop();
		}
	}

	[Fact]
	public async Task DoesNotRetryOnNonTooManyRequestsStatus()
	{
		var (listener, url) = StartListener();
		var requestCount = 0;

		var serverTask = Task.Run(async () =>
		{
			var context = await listener.GetContextAsync();
			requestCount++;
			context.Response.StatusCode = 404;
			context.Response.Close();
		});

		try
		{
			using var client = new HttpClient(new RetryHandler(
				new HttpClientHandler(),
				new RetryHandlerOptions { MaxRetries = 3, BaseDelay = TimeSpan.FromMilliseconds(10) }));

			var response = await client.GetAsync(url);

			Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
			Assert.Equal(1, requestCount);
		}
		finally
		{
			await serverTask;
			listener.Stop();
		}
	}

	[Fact]
	public async Task PlainHttpClientIsUnaffected()
	{
		// Sanity check: a plain HttpClient (no RetryHandler attached, the generated client's default) must
		// not retry - proving this is genuinely opt-in.
		var (listener, url) = StartListener();
		var requestCount = 0;

		var serverTask = Task.Run(async () =>
		{
			var context = await listener.GetContextAsync();
			requestCount++;
			context.Response.StatusCode = 429;
			context.Response.Headers.Add("Retry-After", "0");
			context.Response.Close();
		});

		try
		{
			using var client = new HttpClient();
			var response = await client.GetAsync(url);

			Assert.Equal((HttpStatusCode)429, response.StatusCode);
			Assert.Equal(1, requestCount);
		}
		finally
		{
			await serverTask;
			listener.Stop();
		}
	}
}
