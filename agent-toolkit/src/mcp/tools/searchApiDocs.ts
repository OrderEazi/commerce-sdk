import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDocumentDescription, listOperations, type DocumentName } from '../specLoader';

const inputSchema = {
	query: z.string().describe('Keywords to search for, e.g. "cart", "checkout payment", "wishlist add item"'),
	document: z.enum(['store', 'admin']).default('store').describe('Which OpenAPI document to search - "store" (headless storefront, the common case) or "admin" (back-office integrations)')
};

interface SearchHit {
	kind: 'guide' | 'operation';
	title: string;
	operationId?: string;
	method?: string;
	path?: string;
	snippet: string;
}

function splitIntoSections(markdown: string): { title: string; body: string }[] {
	const sections: { title: string; body: string }[] = [];
	const lines = markdown.split('\n');
	let currentTitle = 'Overview';
	let currentBody: string[] = [];

	for (const line of lines) {
		const heading = line.match(/^##\s+(.*)/);
		if (heading) {
			if (currentBody.length) sections.push({ title: currentTitle, body: currentBody.join('\n').trim() });
			currentTitle = heading[1].trim();
			currentBody = [];
		} else {
			currentBody.push(line);
		}
	}
	if (currentBody.length) sections.push({ title: currentTitle, body: currentBody.join('\n').trim() });
	return sections;
}

export function registerSearchApiDocs(server: McpServer): void {
	server.registerTool(
		'search_api_docs',
		{
			title: 'Search API docs',
			description: 'Full-text search over the OrderEazi Commerce API documentation - operation summaries, tags, and the Getting Started/Auth/Errors/Rate Limits guide sections. Use this before guessing an endpoint name or shape.',
			inputSchema
		},
		async ({ query, document }: { query: string; document: DocumentName }) => {
			const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
			const hits: SearchHit[] = [];

			for (const section of splitIntoSections(getDocumentDescription(document))) {
				const haystack = (section.title + ' ' + section.body).toLowerCase();
				if (terms.some(t => haystack.includes(t))) {
					hits.push({ kind: 'guide', title: section.title, snippet: section.body.slice(0, 400) });
				}
			}

			for (const op of listOperations(document)) {
				const haystack = `${op.tag} ${op.operationId} ${op.summary} ${op.description ?? ''}`.toLowerCase();
				if (terms.some(t => haystack.includes(t))) {
					hits.push({
						kind: 'operation',
						title: `${op.method} ${op.path}`,
						operationId: op.operationId,
						method: op.method,
						path: op.path,
						snippet: op.summary
					});
				}
			}

			if (hits.length === 0) {
				return { content: [{ type: 'text' as const, text: `No matches for "${query}" in the ${document} document. Try a broader term, or call get_endpoint_details if you already know the operationId.` }] };
			}

			const text = hits
				.slice(0, 25)
				.map(h => h.kind === 'operation'
					? `[operation] ${h.operationId} - ${h.method} ${h.path}\n  ${h.snippet}`
					: `[guide] ${h.title}\n  ${h.snippet}`)
				.join('\n\n');

			return { content: [{ type: 'text' as const, text }] };
		}
	);
}
