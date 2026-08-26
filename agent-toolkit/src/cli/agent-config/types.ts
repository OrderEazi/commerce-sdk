export interface StdioServerEntry {
	command: string;
	args: string[];
}

export const SERVER_NAME = 'ordereazi-commerce';

export function serverEntry(): StdioServerEntry {
	return { command: 'npx', args: ['-y', '@ordereazi/commerce-agent-toolkit', 'mcp'] };
}

export interface AgentConfigResult {
	agent: string;
	configPath: string;
	action: 'created' | 'updated' | 'already-present';
}
