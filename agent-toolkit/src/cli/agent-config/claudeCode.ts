// Claude Code project-scope MCP config: .mcp.json at the project root, {"mcpServers": {...}}.
// Project-scoped servers require one-time interactive approval the first time `claude` runs after
// being added - see the note this function's caller prints.
import * as fs from 'fs';
import * as path from 'path';
import { SERVER_NAME, serverEntry, type AgentConfigResult } from './types';

export function claudeCodeConfigPath(cwd: string): string {
	return path.join(cwd, '.mcp.json');
}

export function registerClaudeCode(cwd: string): AgentConfigResult {
	const configPath = claudeCodeConfigPath(cwd);
	const existing = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};

	existing.mcpServers ??= {};

	if (existing.mcpServers[SERVER_NAME]) {
		return { agent: 'Claude Code', configPath, action: 'already-present' };
	}

	const action = fs.existsSync(configPath) ? 'updated' : 'created';
	existing.mcpServers[SERVER_NAME] = serverEntry();

	fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
	return { agent: 'Claude Code', configPath, action };
}
