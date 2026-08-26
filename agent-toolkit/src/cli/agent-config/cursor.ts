// Cursor project-scope MCP config: .cursor/mcp.json, same {"mcpServers": {...}} shape as Claude Code.
import * as fs from 'fs';
import * as path from 'path';
import { SERVER_NAME, serverEntry, type AgentConfigResult } from './types';

export function cursorConfigPath(cwd: string): string {
	return path.join(cwd, '.cursor', 'mcp.json');
}

export function registerCursor(cwd: string): AgentConfigResult {
	const configPath = cursorConfigPath(cwd);
	const existing = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};

	existing.mcpServers ??= {};

	if (existing.mcpServers[SERVER_NAME]) {
		return { agent: 'Cursor', configPath, action: 'already-present' };
	}

	const action = fs.existsSync(configPath) ? 'updated' : 'created';
	existing.mcpServers[SERVER_NAME] = serverEntry();

	fs.mkdirSync(path.dirname(configPath), { recursive: true });
	fs.writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
	return { agent: 'Cursor', configPath, action };
}
