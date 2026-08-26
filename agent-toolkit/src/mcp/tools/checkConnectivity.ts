import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const inputSchema = {
	apiUrl: z.string().describe('Base URL of the running Storefront.Api instance, e.g. "http://localhost:5135" or a deployed URL'),
	storeAccessKey: z.string().describe('The X-Commerce-Key value to test - pk_store_.../sk_store_..., obtained from Backoffice > Settings > Application APIs')
};

// A pk_/sk_ key's JWT secret segment can run past 300 characters - capping the mask at 8 stars keeps
// the response readable instead of dumping a wall of asterisks, without weakening it (the real secret
// material is still fully hidden either way).
function maskKey(key: string): string {
	return key.length <= 4 ? '****' : `${'*'.repeat(Math.min(key.length - 4, 8))}${key.slice(-4)}`;
}

// This is the ONE genuinely live tool in the toolkit - everything else answers from bundled data.
// A cheap, side-effect-free, key-scoped-only endpoint (no bearer token, no mutation) proves the key
// actually works end-to-end, without the agent needing to construct a full authenticated call itself.
export function registerCheckConnectivity(server: McpServer): void {
	server.registerTool(
		'check_connectivity',
		{
			title: 'Check API connectivity',
			description: 'Verifies a Storefront.Api URL is reachable and a Store Access Key actually works, by making one real, harmless, read-only request. Turns "why is my key not working" into a single tool call instead of trial and error.',
			inputSchema
		},
		async ({ apiUrl, storeAccessKey }: { apiUrl: string; storeAccessKey: string }) => {
			const baseUrl = apiUrl.replace(/\/+$/, '');
			const maskedKey = maskKey(storeAccessKey);

			let specReachable = false;
			try {
				const specResponse = await fetch(`${baseUrl}/openapi/store.json`, { signal: AbortSignal.timeout(5000) });
				specReachable = specResponse.ok;
			} catch (err) {
				return {
					content: [{ type: 'text' as const, text: `Could not reach ${baseUrl} at all (${(err as Error).message}). Is Storefront.Api running and is this the right URL?` }],
					isError: true
				};
			}

			if (!specReachable) {
				return {
					content: [{ type: 'text' as const, text: `${baseUrl}/openapi/store.json did not respond with 2xx - this doesn't look like a running Storefront.Api instance at this URL.` }],
					isError: true
				};
			}

			try {
				const response = await fetch(`${baseUrl}/api/v1/store/catalog/categories`, {
					headers: { 'X-Commerce-Key': storeAccessKey },
					signal: AbortSignal.timeout(10000)
				});

				if (response.ok) {
					// The catalogue endpoint returns { categories: [...] }, never a bare array - reading .length off the
					// envelope left count undefined every time, so the "(N categories returned)" half never rendered.
					const body = await response.json().catch(() => undefined) as { categories?: unknown[] } | unknown[] | undefined;
					const categories = Array.isArray(body) ? body : body?.categories;
					const count = Array.isArray(categories) ? categories.length : undefined;
					return {
						content: [{
							type: 'text' as const,
							text: `Connected. ${baseUrl} is reachable and key ...${maskedKey} is valid` + (count !== undefined ? ` (${count} categories returned).` : '.')
						}]
					};
				}

				const problem = await response.json().catch(() => undefined) as { code?: string; detail?: string; title?: string } | undefined;
				const code = problem?.code ?? '(no code field)';
				const detail = problem?.detail ?? problem?.title ?? response.statusText;
				return {
					content: [{
						type: 'text' as const,
						text: `${baseUrl} is reachable, but key ...${maskedKey} failed with HTTP ${response.status}: code="${code}", detail="${detail}"`
					}],
					isError: true
				};
			} catch (err) {
				return {
					content: [{ type: 'text' as const, text: `${baseUrl} responded to /openapi/store.json but the catalog check failed: ${(err as Error).message}` }],
					isError: true
				};
			}
		}
	);
}
