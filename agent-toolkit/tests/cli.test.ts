// Unit-tests the agent-config merge logic against scratch copies - NEVER against this repo's own
// real .mcp.json/.cursor/.vscode configs. Uses this repo's real .vscode/mcp.json (3 pre-existing,
// unrelated server entries) as a copied regression fixture for the merge-not-clobber requirement.
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { registerClaudeCode, claudeCodeConfigPath } from '../src/cli/agent-config/claudeCode';
import { registerCursor, cursorConfigPath } from '../src/cli/agent-config/cursor';
import { registerVsCode, vscodeConfigPath } from '../src/cli/agent-config/vscode';

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..', '..');
const REAL_VSCODE_MCP = path.join(REPO_ROOT, '.vscode', 'mcp.json');

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
	if (condition) {
		passed++;
		console.log(`  ok - ${message}`);
	} else {
		failed++;
		console.error(`  FAIL - ${message}`);
	}
}

function scratchDir(name: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), `oec-cli-test-${name}-`));
	return dir;
}

function main(): void {
	console.log('Claude Code - fresh directory (no existing .mcp.json)');
	{
		const cwd = scratchDir('claude-fresh');
		const result = registerClaudeCode(cwd);
		assert(result.action === 'created', 'reports "created" for a fresh directory');
		const config = JSON.parse(fs.readFileSync(claudeCodeConfigPath(cwd), 'utf8'));
		assert(!!config.mcpServers?.['ordereazi-commerce'], 'writes an mcpServers.ordereazi-commerce entry');
		assert(config.mcpServers['ordereazi-commerce'].command === 'npx', 'entry uses npx as the command');

		const second = registerClaudeCode(cwd);
		assert(second.action === 'already-present', 're-running reports "already-present", not a duplicate write');
	}

	console.log('\nCursor - fresh directory');
	{
		const cwd = scratchDir('cursor-fresh');
		const result = registerCursor(cwd);
		assert(result.action === 'created', 'reports "created" for a fresh directory');
		const config = JSON.parse(fs.readFileSync(cursorConfigPath(cwd), 'utf8'));
		assert(!!config.mcpServers?.['ordereazi-commerce'], 'writes an mcpServers.ordereazi-commerce entry under .cursor/');
	}

	console.log('\nVS Code - fresh directory');
	{
		const cwd = scratchDir('vscode-fresh');
		const result = registerVsCode(cwd);
		assert(result.action === 'created', 'reports "created" for a fresh directory');
		const config = JSON.parse(fs.readFileSync(vscodeConfigPath(cwd), 'utf8'));
		assert(!!config.servers?.['ordereazi-commerce'], 'writes a servers.ordereazi-commerce entry (not mcpServers)');
		assert(config.servers['ordereazi-commerce'].type === 'stdio', 'entry has type: stdio');
	}

	console.log('\nVS Code - real repo fixture (3 pre-existing unrelated servers) - merge, not clobber');
	{
		if (!fs.existsSync(REAL_VSCODE_MCP)) {
			console.log('  skipped - real .vscode/mcp.json fixture not found at ' + REAL_VSCODE_MCP);
		} else {
			const cwd = scratchDir('vscode-real-fixture');
			fs.mkdirSync(path.join(cwd, '.vscode'), { recursive: true });
			fs.copyFileSync(REAL_VSCODE_MCP, path.join(cwd, '.vscode', 'mcp.json'));

			const before = fs.readFileSync(path.join(cwd, '.vscode', 'mcp.json'), 'utf8');
			const beforeParsed = JSON.parse(before);
			const originalServerCount = Object.keys(beforeParsed.servers).length;

			const result = registerVsCode(cwd);
			assert(result.action === 'updated', 'reports "updated" (file already existed)');

			const after = JSON.parse(fs.readFileSync(vscodeConfigPath(cwd), 'utf8'));
			assert(Object.keys(after.servers).length === originalServerCount + 1, `server count grows by exactly 1 (${originalServerCount} -> ${Object.keys(after.servers).length})`);
			assert(!!after.servers['Storefront.McpServer'], 'pre-existing Storefront.McpServer entry survives');
			assert(!!after.servers['storefront-hosted-mcp'], 'pre-existing storefront-hosted-mcp entry survives');
			assert(!!after.servers['warp-atlasian-mcp'], 'pre-existing warp-atlasian-mcp entry survives');
			assert(!!after.servers['ordereazi-commerce'], 'new ordereazi-commerce entry added');
			assert(after.servers['Storefront.McpServer'].command === 'dotnet', 'pre-existing entry content is untouched');
		}
	}

	console.log(`\n${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

main();
