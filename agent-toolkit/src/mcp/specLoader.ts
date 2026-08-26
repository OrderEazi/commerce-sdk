// Loads the bundled OpenAPI snapshots + SDK method manifest + retry policy shipped under
// src/mcp/data/. Bundled and read once at process start - a developer asking "what does the cart
// endpoint look like" shouldn't need Storefront.Api running locally, and check_connectivity (the one
// genuinely live tool) is the only place a network call happens.

import * as fs from 'fs';
import * as path from 'path';

export type DocumentName = 'store' | 'admin';

export interface OpenApiOperation {
	operationId: string;
	method: string;
	path: string;
	tag: string;
	summary: string;
	description?: string;
	requestBodySchema?: unknown;
	responses?: Record<string, unknown>;
}

export interface SdkMethodInfo {
	className: string;
	methodName: string;
	usage: string;
}

export interface CSharpSdkMethodInfo extends SdkMethodInfo {
	interfaceName: string;
	responseType: string;
}

export interface ManifestOperation {
	operationId: string;
	method: string;
	path: string;
	tag: string;
	summary: string;
	sdk: {
		typescript: SdkMethodInfo;
		python: SdkMethodInfo;
		php: SdkMethodInfo;
		csharp: CSharpSdkMethodInfo;
	};
}

const DATA_DIR = path.join(__dirname, 'data');

const specCache = new Map<DocumentName, any>();

function loadSpec(document: DocumentName): any {
	const cached = specCache.get(document);
	if (cached) return cached;

	const specPath = path.join(DATA_DIR, 'openapi', `${document}.json`);
	const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
	specCache.set(document, spec);
	return spec;
}

export function getDocumentDescription(document: DocumentName): string {
	return loadSpec(document).info?.description ?? '';
}

export function listOperations(document: DocumentName): OpenApiOperation[] {
	const spec = loadSpec(document);
	const operations: OpenApiOperation[] = [];

	for (const [urlPath, methods] of Object.entries<any>(spec.paths ?? {})) {
		for (const [httpMethod, op] of Object.entries<any>(methods)) {
			if (!op || typeof op !== 'object' || !op.operationId) continue;

			operations.push({
				operationId: op.operationId,
				method: httpMethod.toUpperCase(),
				path: urlPath,
				tag: op.tags?.[0] ?? 'Default',
				summary: op.summary ?? op.description ?? '',
				description: op.description,
				requestBodySchema: op.requestBody,
				responses: op.responses
			});
		}
	}

	return operations;
}

export function findOperation(document: DocumentName, operationId: string): OpenApiOperation | undefined {
	return listOperations(document).find(op => op.operationId.toLowerCase() === operationId.toLowerCase());
}

export function resolveRef(document: DocumentName, ref: string): unknown {
	// Refs are always "#/components/schemas/Name" in this spec - resolve against the loaded document.
	const spec = loadSpec(document);
	const parts = ref.replace(/^#\//, '').split('/');
	let node: any = spec;
	for (const part of parts) node = node?.[part];
	return node;
}

let manifestCache: { generatedFrom: string; operationCount: number; operations: ManifestOperation[] } | undefined;

export function loadManifest() {
	if (!manifestCache) {
		manifestCache = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'sdk-method-manifest.json'), 'utf8'));
	}
	return manifestCache!;
}

let retryPolicyCache: string | undefined;

export function loadRetryPolicyMarkdown(): string {
	if (!retryPolicyCache) {
		const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'retry-policy.json'), 'utf8'));
		retryPolicyCache = data.markdown;
	}
	return retryPolicyCache!;
}
