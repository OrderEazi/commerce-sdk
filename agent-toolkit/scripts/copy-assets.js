// tsc only emits compiled .js/.d.ts - it doesn't copy the bundled JSON data or the scaffold template
// (a whole separate project, not TypeScript source) into dist/. This runs right after tsc as part of
// `npm run build` to put both where the compiled code's relative __dirname lookups expect them.
const fs = require('fs');
const path = require('path');

const copies = [
	['src/mcp/data', 'dist/mcp/data'],
	['src/scaffold/template', 'dist/scaffold/template']
];

for (const [from, to] of copies) {
	const src = path.join(__dirname, '..', from);
	const dest = path.join(__dirname, '..', to);
	if (!fs.existsSync(src)) {
		console.warn(`Skipping copy - ${from} does not exist yet`);
		continue;
	}
	fs.cpSync(src, dest, { recursive: true });
	console.log(`Copied ${from} -> ${to}`);
}
