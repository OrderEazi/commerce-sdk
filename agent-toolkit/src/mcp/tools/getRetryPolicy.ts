import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadRetryPolicyMarkdown } from '../specLoader';

const LANGUAGES = ['typescript', 'python', 'php', 'csharp'] as const;

const inputSchema = {
	language: z.enum(LANGUAGES).optional().describe('Narrow the response to one language\'s implementation file/mechanism - omit for the full policy')
};

const LANGUAGE_ROW_MARKERS: Record<typeof LANGUAGES[number], string> = {
	typescript: 'TypeScript',
	python: 'Python',
	php: 'PHP',
	csharp: 'C#'
};

export function registerGetRetryPolicy(server: McpServer): void {
	server.registerTool(
		'get_retry_policy',
		{
			title: 'Get retry/backoff policy',
			description: 'Returns the OrderEazi Commerce SDKs\' retry/backoff policy (retry on 429 only, honor Retry-After, exponential backoff otherwise, safe for every HTTP method) - use this so generated integration code wires retry correctly instead of improvising.',
			inputSchema
		},
		async ({ language }: { language?: typeof LANGUAGES[number] }) => {
			const full = loadRetryPolicyMarkdown();

			if (!language) {
				return { content: [{ type: 'text' as const, text: full }] };
			}

			const marker = LANGUAGE_ROW_MARKERS[language];
			const row = full.split('\n').find(line => line.startsWith(`| ${marker} `));
			const text = row
				? `${full}\n\n---\n\nThis SDK's specific implementation: ${row}`
				: full;

			return { content: [{ type: 'text' as const, text }] };
		}
	);
}
