#!/usr/bin/env node
//
// Tests for apply-package-metadata.js. Run: node scripts/apply-package-metadata.test.js
//
// The fixtures are the shapes openapi-generator actually emits, including the ones that already carry
// a value we have to overwrite. Every case here failed on the first implementation: a dynamically
// built regex lost its escapes, so a replace became an append - the generated pyproject kept
// license = "NoLicense" and the csproj kept <Authors>OpenAPI</Authors>, both of which win because the
// duplicate sits later in the file. Nothing about that is visible until the package is public.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { applyPhp, applyPython, applyCsharp } = require('./apply-package-metadata');

const REPO_URL = 'https://github.com/OrderEazi/commerce-sdk';

let failures = 0;

function test(name, fn) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-metadata-'));
	try {
		fn(dir);
		console.log(`  PASS  ${name}`);
	} catch (error) {
		failures++;
		console.error(`  FAIL  ${name}`);
		console.error(`        ${error.message}`);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

function write(dir, relative, contents) {
	const full = path.join(dir, relative);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, contents);
	return full;
}

function read(dir, relative) {
	return fs.readFileSync(path.join(dir, relative), 'utf8');
}

function occurrences(text, needle) {
	return text.split(needle).length - 1;
}

console.log('apply-package-metadata');

test('php: sets licence, author and support links', dir => {
	write(dir, 'composer.json', '{\n  "name": "ordereazi/commerce-sdk",\n  "type": "library"\n}\n');

	applyPhp(dir);

	const json = JSON.parse(read(dir, 'composer.json'));
	assert.strictEqual(json.license, 'MIT');
	assert.strictEqual(json.authors[0].name, 'OrderEazi');
	assert.strictEqual(json.support.issues, `${REPO_URL}/issues`);
	assert.strictEqual(json.name, 'ordereazi/commerce-sdk', 'the package name must survive untouched');
});

test('python pyproject (PEP 621): licence set and urls go in [project.urls]', dir => {
	write(dir, 'pyproject.toml', '[project]\nname = "ordereazi-commerce-sdk"\nversion = "1.0.0"\n\n[build-system]\nrequires = ["setuptools"]\n');

	applyPython(dir);

	const toml = read(dir, 'pyproject.toml');
	assert.ok(toml.includes('license = "MIT"'), 'licence not set');
	assert.ok(toml.includes('[project.urls]'), 'PEP 621 keeps urls in their own table, not as [project] keys');
	assert.ok(toml.includes(`Homepage = "${REPO_URL}"`), 'homepage missing');
	assert.ok(!/^homepage = /m.test(toml), 'a bare homepage key in [project] is not valid PEP 621');
});

test('python pyproject: [project] wins when [tool.poetry] is also present', dir => {
	// This is what openapi-generator actually emits, and the shape that broke the first release: PEP 621
	// metadata in [project], with [tool.poetry] present only to declare dev dependency groups. Treating
	// the file as poetry because that table exists put flat homepage/repository keys into [project], and
	// setuptools rejects the whole file: "`project` must not contain {'homepage','repository'}".
	write(dir, 'pyproject.toml', [
		'[project]',
		'name = "ordereazi_commerce_api"',
		'version = "1.0.0"',
		'authors = [',
		'  {name = "OpenAPI Generator Community",email = "team@openapitools.org"},',
		']',
		'',
		'[project.urls]',
		'Repository = "https://github.com/GIT_USER_ID/GIT_REPO_ID"',
		'',
		'[tool.poetry]',
		'requires-poetry = ">=2.0"',
		''
	].join('\n'));

	applyPython(dir);

	const toml = read(dir, 'pyproject.toml');
	const project = toml.slice(toml.indexOf('[project]'), toml.indexOf('[project.urls]'));

	assert.ok(!/^homepage = /m.test(project), 'a flat homepage key in [project] is what setuptools rejects');
	assert.ok(!/^repository = /m.test(project), 'same for repository');
	assert.ok(project.includes('license = "MIT"'), 'licence goes in [project], not [tool.poetry]');
	assert.ok(project.includes('authors = [{name = "OrderEazi"}]'), 'the generator credits itself by default');
	assert.ok(!toml.includes('openapitools.org'), 'the generator author must be gone, not merely added to');
	assert.ok(!toml.includes('GIT_USER_ID'), 'the placeholder repository url must be replaced');
	assert.ok(toml.includes(`Homepage = "${REPO_URL}"`), 'urls belong in [project.urls]');
	assert.ok(toml.includes('requires-poetry'), '[tool.poetry] itself must survive - it carries dev deps');

	// The distribution name PyPI publishes under is not the Python import name. The generator writes
	// packageName (the module) into [project] name, and PyPI then refuses the upload with "Non-user
	// identities cannot create new projects" because the trusted publisher is registered against a
	// different project name.
	assert.ok(project.includes('name = "ordereazi-commerce-sdk"'), 'the PyPI project name must match the trusted publisher');
	assert.ok(!project.includes('ordereazi_commerce_api'), 'the module name must not be the distribution name');
});

test('python pyproject: rerunning on an already-patched file cleans up rather than compounding', dir => {
	// Idempotence matters because the previous release left these invalid keys behind.
	write(dir, 'pyproject.toml', [
		'[project]',
		'repository = "https://github.com/OrderEazi/commerce-sdk"',
		'homepage = "https://github.com/OrderEazi/commerce-sdk"',
		'license = "MIT"',
		'name = "ordereazi_commerce_api"',
		''
	].join('\n'));

	applyPython(dir);

	const toml = read(dir, 'pyproject.toml');
	const project = toml.slice(toml.indexOf('[project]'), toml.indexOf('[project.urls]'));

	assert.ok(!/^homepage = /m.test(project), 'the invalid key must be removed, not just not re-added');
	assert.ok(!/^repository = /m.test(project));
	assert.strictEqual(occurrences(project, 'license = '), 1, 'licence must not be duplicated on a rerun');
});

test('python pyproject (poetry only): an existing licence is replaced, not duplicated', dir => {
	write(dir, 'pyproject.toml', '[tool.poetry]\nname = "ordereazi-commerce-sdk"\nversion = "1.0.0"\nlicense = "NoLicense"\n');

	applyPython(dir);

	const toml = read(dir, 'pyproject.toml');
	assert.strictEqual(occurrences(toml, 'license = '), 1, 'duplicate license key - the later one wins and it would not be ours');
	assert.ok(toml.includes('license = "MIT"'));
	assert.ok(!toml.includes('NoLicense'));
	assert.ok(toml.includes(`homepage = "${REPO_URL}"`), 'poetry does take flat url keys');
});

test('python setup.py: an existing licence is replaced in place', dir => {
	write(dir, 'setup.py', 'from setuptools import setup\n\nsetup(\n    name="ordereazi-commerce-sdk",\n    license="NoLicense",\n)\n');

	applyPython(dir);

	const py = read(dir, 'setup.py');
	assert.strictEqual(occurrences(py, 'license='), 1, 'duplicate license keyword');
	assert.ok(py.includes('license="MIT"'));
	assert.ok(py.includes(`url="${REPO_URL}"`));
});

test('csharp: the generator default author is replaced, not appended', dir => {
	write(dir, 'src/OrderEazi.Commerce.Sdk/OrderEazi.Commerce.Sdk.csproj',
		'<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n    <Authors>OpenAPI</Authors>\n  </PropertyGroup>\n</Project>\n');

	applyCsharp(dir);

	const xml = read(dir, 'src/OrderEazi.Commerce.Sdk/OrderEazi.Commerce.Sdk.csproj');
	assert.strictEqual(occurrences(xml, '<Authors>'), 1, 'MSBuild takes the LAST declaration - a duplicate publishes under the generator name');
	assert.ok(xml.includes('<Authors>OrderEazi</Authors>'));
	assert.ok(!xml.includes('OpenAPI'));
	assert.ok(xml.includes('<PackageLicenseExpression>MIT</PackageLicenseExpression>'));
	assert.ok(xml.includes(`<RepositoryUrl>${REPO_URL}</RepositoryUrl>`));

	// Two different identities: the product a developer recognises, and the entity that owns the
	// copyright. NuGet renders both, so putting the same value in each loses information.
	assert.ok(xml.includes("<Company>Warp Development</Company>"), "Company is the legal entity");
	assert.ok(xml.includes("<Copyright>Copyright (c) 2026 Warp Development</Copyright>"));
});

test('csharp: test projects are left alone', dir => {
	const project = 'src/OrderEazi.Commerce.Sdk/OrderEazi.Commerce.Sdk.csproj';
	const tests = 'src/OrderEazi.Commerce.Sdk.Test/OrderEazi.Commerce.Sdk.Test.csproj';
	const bare = '<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n  </PropertyGroup>\n</Project>\n';

	write(dir, project, bare);
	write(dir, tests, bare);

	applyCsharp(dir);

	assert.strictEqual(read(dir, tests), bare, 'a test project is not packed and must not claim to be the package');
	assert.ok(read(dir, project).includes('MIT'));
});

test('csharp: a directory with only test projects is an error, not a silent pass', dir => {
	write(dir, 'src/OrderEazi.Commerce.Sdk.Test/OrderEazi.Commerce.Sdk.Test.csproj',
		'<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n  </PropertyGroup>\n</Project>\n');

	const originalExit = process.exit;
	const originalError = console.error;
	let exited = false;

	process.exit = () => { exited = true; throw new Error('exit'); };
	console.error = () => {};

	try {
		applyCsharp(dir);
	} catch {
		// the thrown exit is what we are asserting on
	} finally {
		process.exit = originalExit;
		console.error = originalError;
	}

	assert.ok(exited, 'should have failed rather than publishing an unlicensed package');
});

console.log(failures === 0 ? '\nAll passed.' : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
