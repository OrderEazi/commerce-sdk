#!/usr/bin/env node
//
// Copies the shared LICENSE into the package being packed.
//
// npm only includes files inside the package directory, so a LICENSE one level up is invisible to
// `npm pack` no matter what "files" lists. Run from a prepack script, which covers both `npm pack`
// and `npm publish`. The copy is gitignored - one licence in the repo, no drift between duplicates.

const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'LICENSE');
const destination = path.join(process.cwd(), 'LICENSE');

if (!fs.existsSync(source)) {
	console.error(`copy-license: no LICENSE at ${source}`);
	process.exit(1);
}

fs.copyFileSync(source, destination);
console.log(`copy-license: LICENSE -> ${path.relative(path.join(__dirname, '..'), destination)}`);
