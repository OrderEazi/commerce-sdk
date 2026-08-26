# OrderEazi Commerce Agent Toolkit

An MCP server + CLI that gives an AI coding agent (Claude Code, Cursor, VS Code, etc.) direct,
structured access to the OrderEazi Commerce Store API - so it can scaffold and build a headless
storefront instead of guessing at endpoints and generated SDK method names.

Mirrors the shape of Shopify's own AI agent toolkit (an npm-distributed MCP server + CLI a developer
installs into their coding agent), scoped to this API and this audience: 3rd-party developers building
against `Storefront.Api`'s Store document, not internal back-office tooling.

> **Status**: published on npm as
> [`@ordereazi/commerce-agent-toolkit`](https://www.npmjs.com/package/@ordereazi/commerce-agent-toolkit).

## Install

```bash
npx @ordereazi/commerce-agent-toolkit init
```

Detects Claude Code / Cursor / VS Code from the current directory and registers this toolkit as an MCP
server in the right config file (`.mcp.json`, `.cursor/mcp.json`, or `.vscode/mcp.json`). Existing
entries are never touched - only merged with. Pass `--agent <claude|cursor|vscode|all>` to skip
auto-detection.

Claude Code note: project-scoped MCP servers need one-time approval - run `claude` and approve the
pending server when prompted.

## Scaffold a starter project

```bash
npx @ordereazi/commerce-agent-toolkit create my-storefront --api-url http://localhost:5135
```

Generates a working React + TypeScript + Vite + Tailwind storefront (browse/search, cart, checkout,
orders, account, wishlist) wired to the Store API. Writes a `.env.example` with a placeholder for your
Store Access Key - there's no self-serve API for creating one today, only Backoffice > Settings >
Application APIs (see `<apiUrl>/guides/store`). Copy it to `.env` and fill in the key yourself.

## MCP tools

| Tool | What it does |
|---|---|
| `search_api_docs` | Keyword search over the Store API's operation summaries and Getting Started/Auth/Errors/Rate Limits guide sections |
| `get_endpoint_details` | Full request/response schema for one operation, plus its real per-language SDK method name |
| `list_sdk_methods` | Browses the API as real generated SDK method names - the same operation is a different method signature per language (TS `cartGetCartApi()`, Python `cart_get_cart_api()`, C# `CartGetCartApiAsync()` returning `IApiResponse`) |
| `scaffold_project` | Same as `create` above, callable directly by the agent |
| `check_connectivity` | The one live tool - makes one real, harmless request to prove a Storefront.Api URL + Store Access Key actually work, surfacing the real Problem Details error on failure |
| `get_retry_policy` | Returns the SDKs' retry/backoff policy so generated integration code retries correctly |

Everything except `check_connectivity` answers from data bundled at build time (`src/mcp/data/`) - no
running `Storefront.Api` or JRE needed just to ask "what does the cart endpoint look like."

## Development

```bash
npm install
npm run build              # tsc + copies bundled data/template into dist/
npm test                    # runs both test suites below
```

- `scripts/refresh-openapi-snapshot.sh` - re-fetches `store.json`/`admin.json` from a running
  `Storefront.Api` (`API_URL` env override, default `http://localhost:5135`)
- `npm run manifest:build` - rebuilds `src/mcp/data/sdk-method-manifest.json` from the refreshed
  snapshot, using per-language method-naming rules verified against real generated SDK output (see the
  comment at the top of `scripts/build-manifest.ts`)
- `npm run template:sync` - re-extracts `react-storefront/` (repo root) into `src/scaffold/template/`,
  stripping stale docs/hardcoded keys and templating in `{{PROJECT_NAME}}`/`{{API_URL}}` placeholders

Run these three in order after a `Storefront.Api` change that affects the Store document, then rebuild.

### Tests

- `tests/mcp-tools.test.ts` - spawns the built MCP server as a real child process and drives it with a
  real `@modelcontextprotocol/sdk` `Client` over stdio, calling every tool at least once
- `tests/cli.test.ts` - unit-tests the Claude Code/Cursor/VS Code config merge logic against scratch
  directories, including a regression fixture copied from this repo's own real `.vscode/mcp.json`
  (proves pre-existing, unrelated server entries survive a merge)

## Publishing

Published to npm as `@ordereazi/commerce-agent-toolkit` under the `ordereazi` org. Unlike the other 4
SDKs (still distributed as S3/CloudFront tarball URLs rather than real registry packages - see
`SDK_DEPLOYMENT.md`'s own "Future Improvements"), a coding-agent toolkit has to cold-start via `npx`
with zero repo access, so a real registry publish is a prerequisite here rather than a nice-to-have.

```bash
npm ci && npm run build && npm test
npm publish --otp=<code>     # scoped package; publishConfig.access is already "public"
```

The org has 2FA enforced, so an interactive publish needs an OTP. For a pipeline, use a granular
access token scoped to `@ordereazi` with read/write and the 2FA-bypass option, supplied as `NPM_TOKEN`.

Verify a release the way a 3rd-party developer actually hits it - from a directory with no checkout:

```bash
npx -y @ordereazi/commerce-agent-toolkit@latest --version
```
