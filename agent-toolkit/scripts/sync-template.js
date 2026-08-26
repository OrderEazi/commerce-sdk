// Extracts react-storefront/ (repo root) into src/scaffold/template/ as the `oec create` starter
// template - by script, not by hand, so future react-storefront improvements don't silently drift out
// of the shipped template the same way stale hand-written doc comments drifted this session.
//
// react-storefront itself is left completely untouched - this only ever copies FROM it. Plain
// fs.cpSync (not rsync/rimraf) so this runs the same on a bare Windows Git Bash box as it does in CI.
const fs = require('fs');
const path = require('path');

const SDK_DIR = path.join(__dirname, '..');
const REPO_ROOT = path.join(SDK_DIR, '..', '..', '..', '..');
const SOURCE_DIR = path.join(REPO_ROOT, 'react-storefront');
const TEMPLATE_DIR = path.join(SDK_DIR, 'src', 'scaffold', 'template');

const EXCLUDE = new Set(['node_modules', 'dist', '.vite', 'package-lock.json', 'README.md', 'QUICK_START.md', '.git']);

function shouldExclude(name) {
	return EXCLUDE.has(name) || name.startsWith('.env');
}

if (!fs.existsSync(SOURCE_DIR)) {
	console.error(`Error: ${SOURCE_DIR} not found - expected react-storefront/ at the repo root.`);
	process.exit(1);
}

console.log(`Syncing ${SOURCE_DIR} -> ${TEMPLATE_DIR}...`);
fs.rmSync(TEMPLATE_DIR, { recursive: true, force: true });
fs.mkdirSync(TEMPLATE_DIR, { recursive: true });

fs.cpSync(SOURCE_DIR, TEMPLATE_DIR, {
	recursive: true,
	filter: (src) => !shouldExclude(path.basename(src))
});

// package.json's "name" is templated - create-project.ts substitutes it with the real project name.
const pkgPath = path.join(TEMPLATE_DIR, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = '{{PROJECT_NAME}}';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// .env.example (not .env.development - never ship a real-looking key, even a fake local-dev one).
fs.writeFileSync(path.join(TEMPLATE_DIR, '.env.example'), `# Copy this file to .env and fill in your Store Access Key.
VITE_API_URL={{API_URL}}

# Get this from Backoffice > Settings > Application APIs (there is no self-serve API for this yet -
# see {{API_URL}}/guides/store if you're not sure what this is).
VITE_STORE_API_KEY=
`);

fs.writeFileSync(path.join(TEMPLATE_DIR, 'README.md'), `# {{PROJECT_NAME}}

A headless storefront for OrderEazi Commerce, scaffolded by \`oec create\` - React 19 + TypeScript + Vite +
Tailwind, talking directly to \`Storefront.Api\`'s Store API.

## Setup

1. Get a Store Access Key from Backoffice > Settings > Application APIs (\`pk_store_...\` for browser
   code, \`sk_store_...\` for server-to-server only - see {{API_URL}}/guides/store for details).
2. Copy \`.env.example\` to \`.env\` and fill in \`VITE_STORE_API_KEY\`.
3. \`npm install && npm run dev\`

## Structure

- \`src/lib/api.ts\` - the API client (Axios, sends \`X-Commerce-Key\` on every request, manages the
  \`X-Session-Ref\` anonymous-cart header and the JWT bearer token from login)
- \`src/contexts/\` - Auth/Cart/Store React contexts
- \`src/pages/\` - one file per route (browse, product detail, cart, checkout, orders, account, wishlist)

## Useful links

- API reference: {{API_URL}}/docs/store
- Getting-started guide: {{API_URL}}/guides/store
`);

console.log(`Synced to ${TEMPLATE_DIR}`);
