// VS Code project-scope MCP config: .vscode/mcp.json - top-level key is "servers" (NOT "mcpServers"
// like Claude Code/Cursor), each entry needs "type": "stdio". This file commonly has other unrelated
// servers already in it (and may contain comments, which plain JSON.parse would choke on) - use
// jsonc-parser's modify()/applyEdits() so existing entries, formatting, and comments survive untouched.
import * as fs from 'fs';
import * as path from 'path';
import { parse, modify, applyEdits } from 'jsonc-parser';
import { SERVER_NAME, serverEntry, type AgentConfigResult } from './types';

export function vscodeConfigPath(cwd: string): string {
	return path.join(cwd, '.vscode', 'mcp.json');
}

export function registerVsCode(cwd: string): AgentConfigResult {
	const configPath = vscodeConfigPath(cwd);
	const existingText = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '{}';
	const parsed = parse(existingText) ?? {};

	if (parsed.servers?.[SERVER_NAME]) {
		return { agent: 'VS Code', configPath, action: 'already-present' };
	}

	const action = fs.existsSync(configPath) ? 'updated' : 'created';
	const edits = modify(existingText, ['servers', SERVER_NAME], { type: 'stdio', ...serverEntry() }, {
		formattingOptions: { insertSpaces: true, tabSize: 2 }
	});
	const newText = applyEdits(existingText, edits);

	fs.mkdirSync(path.dirname(configPath), { recursive: true });
	fs.writeFileSync(configPath, newText);
	return { agent: 'VS Code', configPath, action };
}
