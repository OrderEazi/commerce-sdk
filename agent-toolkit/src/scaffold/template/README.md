# {{PROJECT_NAME}}

A headless storefront for OrderEazi Commerce, scaffolded by `oec create` - React 19 + TypeScript + Vite +
Tailwind, talking directly to `Storefront.Api`'s Store API.

## Setup

1. Get a Store Access Key from Backoffice > Settings > Application APIs (`pk_store_...` for browser
   code, `sk_store_...` for server-to-server only - see {{API_URL}}/guides/store for details).
2. Copy `.env.example` to `.env` and fill in `VITE_STORE_API_KEY`.
3. `npm install && npm run dev`

## Structure

- `src/lib/api.ts` - the API client (Axios, sends `X-Commerce-Key` on every request, manages the
  `X-Session-Ref` anonymous-cart header and the JWT bearer token from login)
- `src/contexts/` - Auth/Cart/Store React contexts
- `src/pages/` - one file per route (browse, product detail, cart, checkout, orders, account, wishlist)

## Useful links

- API reference: {{API_URL}}/docs/store
- Getting-started guide: {{API_URL}}/guides/store
