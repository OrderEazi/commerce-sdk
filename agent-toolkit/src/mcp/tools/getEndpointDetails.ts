import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { findOperation, resolveRef, loadManifest, type DocumentName } from '../specLoader';

const inputSchema = {
	operationId: z.string().describe('The operationId to look up, e.g. "CartGetCartApi" - find one via search_api_docs'),
	document: z.enum(['store', 'admin']).default('store')
};

// Schemas reference each other by $ref - resolve one level deep so the agent gets an actually-readable
// shape instead of a wall of {"$ref": "#/components/schemas/..."} it has to chase by hand.
function resolveShallow(document: DocumentName, node: unknown, depth = 0): unknown {
	if (depth > 3 || node === null || typeof node !== 'object') return node;

	if ('$ref' in (node as any)) {
		const resolved = resolveRef(document, (node as any).$ref);
		return resolveShallow(document, resolved, depth + 1);
	}

	if (Array.isArray(node)) {
		return node.map(item => resolveShallow(document, item, depth + 1));
	}

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
		result[key] = resolveShallow(document, value, depth + 1);
	}
	return result;
}

export function registerGetEndpointDetails(server: McpServer): void {
	server.registerTool(
		'get_endpoint_details',
		{
			title: 'Get endpoint details',
			description: 'Full request/response schema for one OpenAPI operation, plus the real generated SDK method name for all 4 languages (TypeScript/Python/PHP/C#) - use this instead of guessing parameter shapes or method names.',
			inputSchema
		},
		async ({ operationId, document }: { operationId: string; document: DocumentName }) => {
			const op = findOperation(document, operationId);
			if (!op) {
				return {
					content: [{ type: 'text' as const, text: `No operation named "${operationId}" in the ${document} document. Use search_api_docs to find the right operationId.` }],
					isError: true
				};
			}

			const manifestOp = document === 'store'
				? loadManifest().operations.find(o => o.operationId.toLowerCase() === operationId.toLowerCase())
				: undefined;

			const details = {
				operationId: op.operationId,
				method: op.method,
				path: op.path,
				tag: op.tag,
				summary: op.summary,
				description: op.description,
				requestBody: op.requestBodySchema ? resolveShallow(document, op.requestBodySchema) : undefined,
				responses: op.responses ? resolveShallow(document, op.responses) : undefined,
				sdkMethods: manifestOp?.sdk ?? 'Not available - get_endpoint_details only maps SDK methods for the "store" document today.'
			};

			return { content: [{ type: 'text' as const, text: JSON.stringify(details, null, 2) }] };
		}
	);
}
