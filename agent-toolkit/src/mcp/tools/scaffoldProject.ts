import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createProject } from '../../scaffold/createProject';

const inputSchema = {
	targetDirectory: z.string().describe('Directory to create the project in - must not already exist or must be empty'),
	projectName: z.string().default('headless-storefront').describe('Name written into the scaffolded package.json'),
	apiUrl: z.string().default('http://localhost:5135').describe('Storefront.Api base URL the scaffolded project will call')
};

export function registerScaffoldProject(server: McpServer): void {
	server.registerTool(
		'scaffold_project',
		{
			title: 'Scaffold a headless storefront project',
			description: 'Generates a working starter storefront (React + TypeScript + Vite + Tailwind, wired to the OrderEazi Commerce Store API) in the given directory. Same logic as running `oec create` from a terminal. Never writes a real Store Access Key - always a placeholder in .env.example, since that has to come from Backoffice manually.',
			inputSchema,
			annotations: {
				destructiveHint: false,
				idempotentHint: false
			}
		},
		async ({ targetDirectory, projectName, apiUrl }: { targetDirectory: string; projectName: string; apiUrl: string }) => {
			try {
				const result = createProject({ targetDirectory, projectName, apiUrl });
				return { content: [{ type: 'text' as const, text: `Scaffolded ${projectName} in ${result.targetDirectory}.\n\nNext steps:\n${result.nextSteps.map(s => `- ${s}`).join('\n')}` }] };
			} catch (err) {
				return { content: [{ type: 'text' as const, text: `Could not scaffold project: ${(err as Error).message}` }], isError: true };
			}
		}
	);
}
