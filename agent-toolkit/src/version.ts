import { readFileSync } from 'fs';
import { join } from 'path';

// Read from the package's own manifest rather than hardcoding. Both the CLI's --version and the MCP
// server's serverInfo used to carry their own literal, so a release bump silently left them reporting
// the previous version - `npx ...@latest --version` printed 1.0.0 even on 1.0.1.
// Not a JSON import: package.json sits outside tsconfig's rootDir, so importing it would restructure
// the dist layout. It is always present in a published tarball, one level up from dist/.
export const VERSION: string = (() => {
	try {
		return JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')).version ?? '0.0.0';
	} catch {
		return '0.0.0';
	}
})();
