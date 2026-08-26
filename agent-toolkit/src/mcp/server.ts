#!/usr/bin/env node
// MCP server entry point - started as `oec mcp` (wired into an agent's config by `oec init`), talking
// JSON-RPC over stdio. IMPORTANT: stdout is the protocol channel - never console.log() here or from
// any tool handler. Use console.error() for anything diagnostic.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerSearchApiDocs } from './tools/searchApiDocs';
import { registerGetEndpointDetails } from './tools/getEndpointDetails';
import { registerListSdkMethods } from './tools/listSdkMethods';
import { registerCheckConnectivity } from './tools/checkConnectivity';
import { registerGetRetryPolicy } from './tools/getRetryPolicy';
import { registerScaffoldProject } from './tools/scaffoldProject';
import { VERSION } from '../version';

export function createServer(): McpServer {
	const server = new McpServer({
		name: 'ordereazi-commerce-agent-toolkit',
		version: VERSION
	});

	registerSearchApiDocs(server);
	registerGetEndpointDetails(server);
	registerListSdkMethods(server);
	registerCheckConnectivity(server);
	registerGetRetryPolicy(server);
	registerScaffoldProject(server);

	return server;
}

export async function runStdioServer(): Promise<void> {
	const server = createServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('OrderEazi Commerce agent toolkit MCP server running on stdio.');
}

if (require.main === module) {
	runStdioServer().catch(err => {
		console.error('Fatal error starting MCP server:', err);
		process.exit(1);
	});
}
