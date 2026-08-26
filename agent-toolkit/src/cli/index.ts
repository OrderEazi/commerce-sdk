#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from './commands/init';
import { runCreate } from './commands/create';
import { VERSION } from '../version';

const program = new Command();

program
	.name('oec')
	.description('CLI + MCP toolkit for building a headless storefront against the OrderEazi Commerce Store API')
	.version(VERSION);

program
	.command('init')
	.description('Register this toolkit as an MCP server in your coding agent\'s config (Claude Code, Cursor, or VS Code)')
	.option('--agent <agent>', 'claude, cursor, vscode, or all - omit to auto-detect from the current directory')
	.action(runInit);

program
	.command('create <name>')
	.description('Scaffold a starter headless storefront wired to the Store API')
	.option('--api-url <url>', 'Storefront.Api base URL the scaffolded project will call')
	.option('--template <name>', 'Scaffold template to use (default and only option today: react)')
	.option('-y, --yes', 'Skip interactive prompts, use defaults')
	.action(runCreate);

program
	.command('mcp', { hidden: true })
	.description('Start the MCP server over stdio (used internally by `oec init`\'s registered config - not meant to be run interactively)')
	.action(async () => {
		const { runStdioServer } = await import('../mcp/server');
		await runStdioServer();
	});

program.parse(process.argv);
