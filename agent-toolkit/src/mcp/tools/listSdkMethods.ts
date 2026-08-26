import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadManifest } from '../specLoader';

const LANGUAGES = ['typescript', 'python', 'php', 'csharp'] as const;

const inputSchema = {
	tag: z.string().optional().describe('Filter to one API area, e.g. "Cart", "Checkout" - omit to browse everything'),
	search: z.string().optional().describe('Filter by keyword in the operationId or summary'),
	language: z.enum(LANGUAGES).default('typescript').describe('Which SDK to show method names for')
};

export function registerListSdkMethods(server: McpServer): void {
	server.registerTool(
		'list_sdk_methods',
		{
			title: 'List SDK methods',
			description: 'Browse the OrderEazi Commerce Store API as real, generated SDK method names for a given language - the same OpenAPI operation has a different method name/signature per language (e.g. CartGetCartApi -> TypeScript cartGetCartApi(), Python cart_get_cart_api(), C# CartGetCartApiAsync()). Use this instead of assuming a name.',
			inputSchema
		},
		async ({ tag, search, language }: { tag?: string; search?: string; language: typeof LANGUAGES[number] }) => {
			const manifest = loadManifest();
			let ops = manifest.operations;

			if (tag) ops = ops.filter(o => o.tag.toLowerCase() === tag.toLowerCase());
			if (search) {
				const needle = search.toLowerCase();
				ops = ops.filter(o => o.operationId.toLowerCase().includes(needle) || o.summary.toLowerCase().includes(needle));
			}

			if (ops.length === 0) {
				return { content: [{ type: 'text' as const, text: 'No matching operations. Omit tag/search to see the full list, or call search_api_docs for a broader keyword search.' }] };
			}

			const lines = ops.map(op => {
				const sdk = op.sdk[language];
				const call = language === 'csharp'
					? `${(sdk as any).interfaceName}.${sdk.methodName}() -> ${(sdk as any).responseType}`
					: `${sdk.className}.${sdk.methodName}()`;
				return `${op.operationId} (${op.method} ${op.path})\n  ${call}\n  ${op.summary}`;
			});

			return { content: [{ type: 'text' as const, text: lines.join('\n\n') }] };
		}
	);
}
