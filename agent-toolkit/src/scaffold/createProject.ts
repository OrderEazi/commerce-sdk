// Shared by `oec create` and the scaffold_project MCP tool - one implementation, two entry points.
import * as fs from 'fs';
import * as path from 'path';

export interface CreateProjectOptions {
	targetDirectory: string;
	projectName: string;
	apiUrl: string;
}

export interface CreateProjectResult {
	targetDirectory: string;
	nextSteps: string[];
}

const TEMPLATE_DIR = path.join(__dirname, 'template');

function substitutePlaceholders(content: string, projectName: string, apiUrl: string): string {
	return content.split('{{PROJECT_NAME}}').join(projectName).split('{{API_URL}}').join(apiUrl);
}

const TEXT_FILE_EXTENSIONS = new Set(['.json', '.md', '.example', '.js', '.ts', '.tsx', '.html', '.css']);

function copyAndSubstitute(source: string, dest: string, projectName: string, apiUrl: string): void {
	const stat = fs.statSync(source);

	if (stat.isDirectory()) {
		fs.mkdirSync(dest, { recursive: true });
		for (const entry of fs.readdirSync(source)) {
			copyAndSubstitute(path.join(source, entry), path.join(dest, entry), projectName, apiUrl);
		}
		return;
	}

	if (TEXT_FILE_EXTENSIONS.has(path.extname(source))) {
		const content = fs.readFileSync(source, 'utf8');
		fs.writeFileSync(dest, substitutePlaceholders(content, projectName, apiUrl));
	} else {
		fs.copyFileSync(source, dest);
	}
}

// Deliberately never accepts a raw store-key value as a parameter - always writes the .env.example
// placeholder, same as a human running `oec create` would get. A Store Access Key can only be obtained
// manually from Backoffice today (see RETRY_POLICY.md-adjacent context in the toolkit's README) - an
// agent shouldn't be the thing sourcing or persisting that secret on a developer's behalf.
export function createProject(options: CreateProjectOptions): CreateProjectResult {
	const { targetDirectory, projectName, apiUrl } = options;

	if (!fs.existsSync(TEMPLATE_DIR)) {
		throw new Error(`Scaffold template not found at ${TEMPLATE_DIR} - this build is missing its bundled template.`);
	}

	if (fs.existsSync(targetDirectory) && fs.readdirSync(targetDirectory).length > 0) {
		throw new Error(`${targetDirectory} already exists and is not empty.`);
	}

	copyAndSubstitute(TEMPLATE_DIR, targetDirectory, projectName, apiUrl);

	return {
		targetDirectory,
		nextSteps: [
			`Get a Store Access Key from ${apiUrl}/guides/store (Backoffice > Settings > Application APIs)`,
			`Copy ${path.join(targetDirectory, '.env.example')} to .env and fill in VITE_STORE_API_KEY`,
			`cd ${targetDirectory} && npm install && npm run dev`
		]
	};
}
