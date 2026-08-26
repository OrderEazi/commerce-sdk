// Spawns the built MCP server as a real child process and drives it with a real MCP Client over
// stdio - the standard way to test an MCP server end-to-end without a real coding agent in the loop.
// Run with: ts-node tests/mcp-tools.test.ts (requires `npm run build` first - this runs against dist/).
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER_ENTRY = path.join(__dirname, '..', 'dist', 'mcp', 'server.js');

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

async function main(): Promise<void> {
	const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER_ENTRY] });
	const client = new Client({ name: 'toolkit-test-client', version: '1.0.0' });

	await client.connect(transport);
	console.log('Connected to MCP server.\n');

	console.log('tools/list');
	const { tools } = await client.listTools();
	const toolNames = tools.map(t => t.name).sort();
	assert(toolNames.includes('search_api_docs'), 'search_api_docs is registered');
	assert(toolNames.includes('get_endpoint_details'), 'get_endpoint_details is registered');
	assert(toolNames.includes('list_sdk_methods'), 'list_sdk_methods is registered');
	assert(toolNames.includes('check_connectivity'), 'check_connectivity is registered');
	assert(toolNames.includes('get_retry_policy'), 'get_retry_policy is registered');
	assert(toolNames.includes('scaffold_project'), 'scaffold_project is registered');
	assert(tools.length === 6, `exactly 6 tools registered (got ${tools.length})`);

	console.log('\nsearch_api_docs("cart")');
	const search = await client.callTool({ name: 'search_api_docs', arguments: { query: 'cart' } });
	const searchText = (search.content as any[])[0]?.text ?? '';
	assert(searchText.includes('Cart'), 'search_api_docs finds cart-related operations');

	console.log('\nget_endpoint_details("CartGetCartApi")');
	const details = await client.callTool({ name: 'get_endpoint_details', arguments: { operationId: 'CartGetCartApi' } });
	const detailsText = (details.content as any[])[0]?.text ?? '';
	assert(detailsText.includes('cartGetCartApi'), 'get_endpoint_details includes the real TS method name');
	assert(detailsText.includes('cart_get_cart_api'), 'get_endpoint_details includes the real Python method name');
	assert(detailsText.includes('CartGetCartApiAsync'), 'get_endpoint_details includes the real C# method name');

	console.log('\nlist_sdk_methods({tag: "Cart", language: "python"})');
	const listed = await client.callTool({ name: 'list_sdk_methods', arguments: { tag: 'Cart', language: 'python' } });
	const listedText = (listed.content as any[])[0]?.text ?? '';
	assert(listedText.includes('cart_get_cart_api'), 'list_sdk_methods returns snake_case for python');

	console.log('\nget_retry_policy()');
	const retryPolicy = await client.callTool({ name: 'get_retry_policy', arguments: {} });
	const retryText = (retryPolicy.content as any[])[0]?.text ?? '';
	assert(retryText.includes('429'), 'get_retry_policy returns the actual policy content');

	console.log('\ncheck_connectivity (unreachable host - must fail cleanly, not crash)');
	// Deliberately an unreachable port, not a real dev URL: this assertion used to point at
	// localhost:5135 and only passed when a Storefront.Api happened to be running there, so `npm test`
	// failed on a clean checkout for a reason that had nothing to do with the toolkit.
	const unreachable = await client.callTool({ name: 'check_connectivity', arguments: { apiUrl: 'http://127.0.0.1:1', storeAccessKey: 'invalid_test_key_xyz' } });
	const unreachableText = (unreachable.content as any[])[0]?.text ?? '';
	assert(unreachable.isError === true, 'check_connectivity reports isError when the host is unreachable');
	assert(unreachableText.includes('Could not reach'), 'check_connectivity explains that the host was unreachable');
	assert(!unreachableText.includes('invalid_test_key_xyz'), 'check_connectivity masks the key in its response text');

	// Opt-in: only a reachable Storefront.Api can prove the real Problem Details code is surfaced.
	// e.g. OEC_TEST_API_URL=https://commerce-api-alpha.ordereazi.com npm test
	const liveUrl = process.env.OEC_TEST_API_URL;
	if (liveUrl) {
		console.log(`\ncheck_connectivity (live server at ${liveUrl}, bad key)`);
		const live = await client.callTool({ name: 'check_connectivity', arguments: { apiUrl: liveUrl, storeAccessKey: 'invalid_test_key_xyz' } });
		const liveText = (live.content as any[])[0]?.text ?? '';
		assert(live.isError === true, 'check_connectivity reports isError for an invalid key against a live server');
		assert(liveText.includes('store_key_invalid'), 'check_connectivity surfaces the real Problem Details code');
		assert(!liveText.includes('invalid_test_key_xyz'), 'check_connectivity masks the key against a live server too');
	} else {
		console.log('\ncheck_connectivity (live server) - skipped, set OEC_TEST_API_URL to enable');
	}

	await client.close();

	console.log(`\n${passed} passed, ${failed} failed`);
	if (failed > 0) process.exit(1);
}

main().catch(err => {
	console.error('Test run crashed:', err);
	process.exit(1);
});
