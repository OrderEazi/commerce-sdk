// Builds src/mcp/data/sdk-method-manifest.json from the bundled store.json snapshot.
//
// operationId -> real per-language SDK method name, derived from conventions VERIFIED against actual
// openapi-generator output this session (not guessed) - see AgentToolkit's plan/README for the
// verification trail. This is the direct fix for a real bug class hit repeatedly while building the 4
// SDKs: a coding agent (or a human) assuming a method name that doesn't match what the generator
// actually produced for a given language.
//
// Verified rules (checked against real generated TypeScript output; Python/PHP/C# confirmed earlier
// this session against their own real generated source):
//   - Tag -> class name:      strip everything except letters/digits, append "Api"
//                             e.g. "Account - Addresses" -> "AccountAddressesApi"
//   - TypeScript method:      operationId with first letter lowercased (e.g. CartGetCartApi -> cartGetCartApi)
//   - PHP method:             same as TypeScript
//   - Python method:          operationId converted to snake_case (e.g. CartGetCartApi -> cart_get_cart_api)
//   - C# method:               operationId + "Async" suffix, returns `I{operationId}ApiResponse` -
//                              call `.Ok()` / `.Unauthorized()` / etc. for the typed body of a given status

import * as fs from 'fs';
import * as path from 'path';

const SPEC_PATH = path.join(__dirname, '..', 'src', 'mcp', 'data', 'openapi', 'store.json');
const OUT_PATH = path.join(__dirname, '..', 'src', 'mcp', 'data', 'sdk-method-manifest.json');

function tagToClassName(tag: string): string {
	return tag.replace(/[^A-Za-z0-9]/g, '') + 'Api';
}

function toCamelCase(operationId: string): string {
	return operationId.charAt(0).toLowerCase() + operationId.slice(1);
}

function toSnakeCase(operationId: string): string {
	return operationId.replace(/(?<!^)([A-Z])/g, '_$1').toLowerCase();
}

interface SpecOperation {
	operationId: string;
	tags?: string[];
	summary?: string;
	description?: string;
}

interface ManifestOperation {
	operationId: string;
	method: string;
	path: string;
	tag: string;
	summary: string;
	sdk: {
		typescript: { className: string; methodName: string; usage: string };
		python: { className: string; methodName: string; usage: string };
		php: { className: string; methodName: string; usage: string };
		csharp: { className: string; interfaceName: string; methodName: string; responseType: string; usage: string };
	};
}

function build(): void {
	const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
	const operations: ManifestOperation[] = [];

	for (const [urlPath, methods] of Object.entries<Record<string, SpecOperation>>(spec.paths)) {
		for (const [httpMethod, op] of Object.entries(methods)) {
			if (!op || typeof op !== 'object' || !('operationId' in op)) continue;

			const operationId = op.operationId;
			const tag = op.tags?.[0] ?? 'Default';
			const className = tagToClassName(tag);
			const tsMethod = toCamelCase(operationId);
			const pyMethod = toSnakeCase(operationId);
			const phpMethod = toCamelCase(operationId);
			const csMethod = `${operationId}Async`;
			const csResponseType = `I${operationId}ApiResponse`;

			operations.push({
				operationId,
				method: httpMethod.toUpperCase(),
				path: urlPath,
				tag,
				summary: op.summary ?? op.description ?? '',
				sdk: {
					typescript: {
						className,
						methodName: tsMethod,
						usage: `const api = new ${className}(config); const result = await api.${tsMethod}(/* see get_endpoint_details for params */); // result.data`
					},
					python: {
						className,
						methodName: pyMethod,
						usage: `api = ${className}(api_client); result = api.${pyMethod}(...)  # see get_endpoint_details for params`
					},
					php: {
						className,
						methodName: phpMethod,
						usage: `$api = new ${className}(null, $config); $result = $api->${phpMethod}(...); // see get_endpoint_details for params`
					},
					csharp: {
						className,
						interfaceName: `I${className}`,
						methodName: csMethod,
						responseType: csResponseType,
						usage: `var response = await api.${csMethod}(/* see get_endpoint_details for params */); var result = response.Ok(); // or .Unauthorized(), .NotFound(), etc. per status`
					}
				}
			});
		}
	}

	operations.sort((a, b) => a.operationId.localeCompare(b.operationId));

	fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedFrom: 'store.json', operationCount: operations.length, operations }, null, 2));
	console.log(`Wrote ${operations.length} operations to ${OUT_PATH}`);
}

build();
