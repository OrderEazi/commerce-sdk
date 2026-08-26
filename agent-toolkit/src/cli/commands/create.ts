import * as path from 'path';
import prompts from 'prompts';
import { createProject } from '../../scaffold/createProject';

export interface CreateCommandOptions {
	apiUrl?: string;
	template?: string;
	yes?: boolean;
}

export async function runCreate(name: string, options: CreateCommandOptions): Promise<void> {
	if (options.template && options.template !== 'react') {
		console.error(`Unknown template "${options.template}" - only "react" is available today.`);
		process.exitCode = 1;
		return;
	}

	let apiUrl = options.apiUrl;
	if (!apiUrl && !options.yes) {
		const response = await prompts({
			type: 'text',
			name: 'apiUrl',
			message: 'Storefront.Api base URL',
			initial: 'http://localhost:5135'
		});
		apiUrl = response.apiUrl;
	}
	apiUrl = apiUrl || 'http://localhost:5135';

	const targetDirectory = path.resolve(process.cwd(), name);

	try {
		const result = createProject({ targetDirectory, projectName: name, apiUrl });
		console.log(`\nScaffolded "${name}" in ${result.targetDirectory}\n`);
		console.log('Next steps:');
		for (const step of result.nextSteps) console.log(`  - ${step}`);
		console.log('');
	} catch (err) {
		console.error(`Could not create project: ${(err as Error).message}`);
		process.exitCode = 1;
	}
}
