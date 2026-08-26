# OrderEazi Commerce SDKs

Client libraries for the OrderEazi Commerce API, plus an MCP toolkit for AI coding agents.

| Language | Install | Package |
|---|---|---|
| TypeScript | `npm install @ordereazi/commerce-sdk` | [npm](https://www.npmjs.com/package/@ordereazi/commerce-sdk) |
| Python | `pip install ordereazi-commerce-sdk` | [PyPI](https://pypi.org/project/ordereazi-commerce-sdk/) |
| PHP | `composer require ordereazi/commerce-sdk` | [Packagist](https://packagist.org/packages/ordereazi/commerce-sdk) |
| C# | `dotnet add package OrderEazi.Commerce.Sdk` | [NuGet](https://www.nuget.org/packages/OrderEazi.Commerce.Sdk/) |
| Agent toolkit | `npx @ordereazi/commerce-agent-toolkit` | [npm](https://www.npmjs.com/package/@ordereazi/commerce-agent-toolkit) |

## What these talk to

The Commerce API has two surfaces, and they are not interchangeable:

- **Store** — a headless storefront. Catalogue, cart, checkout, accounts. Authenticated with a store
  key, which comes in a publishable (`pk_`, browser-safe) and a secret (`sk_`) form.
- **Admin** — back-office operations. Authenticated with an admin key (`sk_admin_`), which is
  server-to-server only and is refused outright if the request carries a browser `Origin` header.

The four SDKs are generated against the **store** surface. The agent toolkit knows both.

## Agent toolkit

If you are building a storefront with an AI coding agent, point it at the toolkit rather than letting
it guess endpoint names:

```bash
npx @ordereazi/commerce-agent-toolkit init      # writes the MCP config for your agent
npx @ordereazi/commerce-agent-toolkit create my-storefront
```

It runs as an MCP server exposing the API documentation, endpoint shapes and SDK method names as
tools. It is read-only: it tells an agent what the API looks like, it does not call it.

## Layout

```
typescript/      hand-written package, generated client underneath it
python/          generator config + retry middleware + tests
php/             generator config + retry middleware + tests
dotnet/          generator config + RetryHandler + tests
agent-toolkit/   MCP server + CLI
scripts/         packaging helpers shared by the generated SDKs
```

The four clients are generated from the API's live OpenAPI document at release time, so `generated/`
directories are build output and are not committed. The PHP client is additionally published to
[commerce-sdk-php](https://github.com/OrderEazi/commerce-sdk-php), because Packagist can only publish
a composer package from a repository root — that repo is generated, and issues belong here.

## Retry behaviour

Each SDK ships hand-written retry middleware rather than leaving it to the caller: idempotent
requests are retried with exponential backoff and jitter, writes are not retried unless they carry an
idempotency key, and `Retry-After` is honoured on 429. One policy covers all four - see
[RETRY_POLICY.md](RETRY_POLICY.md).

## Releasing

Tags drive releases. `v1.2.0` publishes the four SDKs; `toolkit-v1.1.0` publishes the agent toolkit,
which versions independently because it changes when its tools change rather than when the API does.

Every registry authenticates by OIDC - there are no publishing tokens stored in this repository.

## Licence

MIT. Copyright (c) 2026 Warp Development. OrderEazi is a Warp Development product.
