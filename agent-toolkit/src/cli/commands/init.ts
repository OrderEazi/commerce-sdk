import * as fs from 'fs';
import * as path from 'path';
import { registerClaudeCode } from '../agent-config/claudeCode';
import { registerCursor } from '../agent-config/cursor';
import { registerVsCode } from '../agent-config/vscode';
import type { AgentConfigResult } from '../agent-config/types';

export interface InitCommandOptions {
	agent?: string;
}

const DETECTORS: { marker: string; agent: string; register: (cwd: string) => AgentConfigResult }[] = [
	{ marker: '.claude', agent: 'claude', register: registerClaudeCode },
	{ marker: '.cursor', agent: 'cursor', register: registerCursor },
	{ marker: '.vscode', agent: 'vscode', register: registerVsCode }
];

function describe(result: AgentConfigResult): string {
	const verb = result.action === 'already-present' ? 'already registered in' : result.action === 'created' ? 'created' : 'updated';
	return `${result.agent}: ${verb} ${result.configPath}`;
}

export async function runInit(options: InitCommandOptions): Promise<void> {
	const cwd = process.cwd();
	const requested = options.agent?.toLowerCase();

	const targets = requested && requested !== 'all'
		? DETECTORS.filter(d => d.agent === requested)
		: DETECTORS.filter(d => fs.existsSync(path.join(cwd, d.marker)));

	if (targets.length === 0) {
		if (requested && requested !== 'all') {
			console.error(`Unknown --agent value "${options.agent}" - expected one of: claude, cursor, vscode, all.`);
			process.exitCode = 1;
			return;
		}
		console.log('No .claude/, .cursor/, or .vscode/ directory found in the current directory.');
		console.log('Pass --agent <claude|cursor|vscode|all> to register anyway.');
		return;
	}

	console.log('Registering the OrderEazi Commerce agent toolkit as an MCP server...\n');

	for (const target of targets) {
		const result = target.register(cwd);
		console.log(`  ${describe(result)}`);
	}

	if (targets.some(t => t.agent === 'claude')) {
		console.log('\nClaude Code note: project-scoped MCP servers need one-time approval - run `claude` and approve the pending server when prompted.');
	}

	console.log('\nDone. Restart your agent (or reload its MCP connections) to pick up the new server.');
}
