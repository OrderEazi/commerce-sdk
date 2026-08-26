#!/usr/bin/env node
//
// Writes licence, author and repository metadata into a freshly generated SDK.
//
// openapi-generator exposes some of this as --additional-properties, but not the same set for every
// language and not stably across versions - and a flag it silently ignores publishes an unlicensed
// package to a public registry, which is exactly the failure nobody notices. Patching the generated
// manifest afterwards works the same way for all three languages and can be tested without a JRE.
//
// Usage: node apply-package-metadata.js <php|python|csharp> <generated-dir>
// Exits non-zero if the manifest could not be found or written - a release must not proceed without it.

const fs = require('fs');
const path = require('path');

const LICENSE = 'MIT';
// OrderEazi is the product and what a developer sees on the package page; Warp Development is the
// legal entity that holds the copyright. NuGet has a field for each, so each gets the right one.
const AUTHOR = 'OrderEazi';
const COMPANY = 'Warp Development';
const REPO_URL = 'https://github.com/OrderEazi/commerce-sdk';

function fail(message) {
	console.error(`apply-package-metadata: ${message}`);
	process.exit(1);
}

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
}

function applyPhp(dir) {
	const manifest = path.join(dir, 'composer.json');
	if (!fs.existsSync(manifest)) fail(`no composer.json in ${dir}`);

	const json = readJson(manifest);
	json.license = LICENSE;
	json.homepage = REPO_URL;
	json.authors = [{ name: AUTHOR, homepage: REPO_URL }];
	json.support = { issues: `${REPO_URL}/issues`, source: REPO_URL };

	fs.writeFileSync(manifest, JSON.stringify(json, null, 4) + '\n');
	return manifest;
}

// The python generator has emitted setup.py in some versions and pyproject.toml in others, so both
// are handled rather than pinning to whichever this generator version happens to produce today.
function applyPython(dir) {
	const pyproject = path.join(dir, 'pyproject.toml');
	const setup = path.join(dir, 'setup.py');

	if (fs.existsSync(pyproject)) {
		let toml = fs.readFileSync(pyproject, 'utf8');

		toml = setTomlKey(toml, 'license', `"${LICENSE}"`);

		// The two pyproject shapes spell URLs differently, and writing poetry's flat keys into a PEP 621
		// [project] table produces a file the build backend rejects.
		if (findTable(toml, 'tool.poetry') !== -1) {
			toml = setTomlKey(toml, 'homepage', `"${REPO_URL}"`);
			toml = setTomlKey(toml, 'repository', `"${REPO_URL}"`);
		} else {
			toml = setProjectUrls(toml);
		}

		fs.writeFileSync(pyproject, toml);
		return pyproject;
	}

	if (fs.existsSync(setup)) {
		let py = fs.readFileSync(setup, 'utf8');

		py = setSetupKeyword(py, 'license', `"${LICENSE}"`);
		py = setSetupKeyword(py, 'url', `"${REPO_URL}"`);

		fs.writeFileSync(setup, py);
		return setup;
	}

	fail(`no pyproject.toml or setup.py in ${dir}`);
}

// Line index of a table header, or -1. Matching is done line-by-line throughout rather than with
// built regexes: a dynamically constructed pattern needs its escapes doubled, and one lost backslash
// turns a replace into a silent append that leaves the generator's own value in place.
function findTable(toml, name) {
	return toml.split('\n').findIndex(line => line.trim() === `[${name}]`);
}

function isKeyLine(line, key) {
	const trimmed = line.trim();
	if (!trimmed.startsWith(key)) return false;

	return trimmed.slice(key.length).trimStart().startsWith('=');
}

// Replaces key in place if present, otherwise adds it directly under the first table header. In place
// matters: a generated pyproject can already declare license = "NoLicense", and a duplicate key means
// the parser takes one of the two and it will not be ours.
function setTomlKey(toml, key, value) {
	const lines = toml.split('\n');

	const existing = lines.findIndex(line => isKeyLine(line, key));
	if (existing !== -1) {
		lines[existing] = `${key} = ${value}`;
		return lines.join('\n');
	}

	const table = lines.findIndex(line => line.trim() === '[project]' || line.trim() === '[tool.poetry]');
	if (table === -1) fail('pyproject.toml has neither a [project] nor a [tool.poetry] table');

	lines.splice(table + 1, 0, `${key} = ${value}`);
	return lines.join('\n');
}

// PEP 621 keeps URLs in their own table rather than as [project] keys.
function setProjectUrls(toml) {
	const lines = toml.split('\n');
	const urls = lines.findIndex(line => line.trim() === '[project.urls]');

	if (urls !== -1) {
		const next = lines.findIndex((line, i) => i > urls && line.trim().startsWith('['));
		const end = next === -1 ? lines.length : next;
		const kept = lines
			.slice(urls + 1, end)
			.filter(line => !isKeyLine(line, 'Homepage') && !isKeyLine(line, 'Repository'));

		lines.splice(urls + 1, end - urls - 1, ...kept, `Homepage = "${REPO_URL}"`, `Repository = "${REPO_URL}"`);
		return lines.join('\n');
	}

	// A new table has to go at the end - opening one mid-file would swallow every key after it.
	const trimmed = toml.replace(/\s+$/, '');
	return `${trimmed}\n\n[project.urls]\nHomepage = "${REPO_URL}"\nRepository = "${REPO_URL}"\n`;
}

function setSetupKeyword(py, keyword, value) {
	const lines = py.split('\n');

	const existing = lines.findIndex(line => isKeyLine(line, keyword));
	if (existing !== -1) {
		const indent = lines[existing].slice(0, lines[existing].length - lines[existing].trimStart().length);
		lines[existing] = `${indent}${keyword}=${value},`;
		return lines.join('\n');
	}

	const call = lines.findIndex(line => line.includes('setup('));
	if (call === -1) fail('setup.py has no setup( call to add metadata to');

	lines.splice(call + 1, 0, `    ${keyword}=${value},`);
	return lines.join('\n');
}

// PackageLicenseExpression is what NuGet reads; the older PackageLicenseUrl is deprecated and shows a
// warning on the package page.
function applyCsharp(dir) {
	const projects = findCsproj(dir);
	if (projects.length === 0) fail(`no .csproj under ${dir}`);

	// Test projects are not packed and must not claim to be the published package.
	const packable = projects.filter(p => !/\.tests?\.csproj$/i.test(path.basename(p)));
	if (packable.length === 0) fail(`only test projects found under ${dir}`);

	for (const project of packable) {
		let xml = fs.readFileSync(project, 'utf8');

		xml = setMsBuildProperty(xml, 'PackageLicenseExpression', LICENSE);
		xml = setMsBuildProperty(xml, 'Authors', AUTHOR);
		xml = setMsBuildProperty(xml, 'Company', COMPANY);
		xml = setMsBuildProperty(xml, 'PackageProjectUrl', REPO_URL);
		xml = setMsBuildProperty(xml, 'RepositoryUrl', REPO_URL);
		xml = setMsBuildProperty(xml, 'RepositoryType', 'git');
		xml = setMsBuildProperty(xml, 'Copyright', `Copyright (c) 2026 ${COMPANY}`);

		fs.writeFileSync(project, xml);
	}

	return packable.join(', ');
}

// Replaces the element in place if present. MSBuild takes the LAST declaration, so appending a second
// <Authors> next to the generator's own would publish under the generator's name, not ours.
function setMsBuildProperty(xml, element, value) {
	const lines = xml.split('\n');
	const open = `<${element}>`;
	const close = `</${element}>`;

	const existing = lines.findIndex(line => line.trim().startsWith(open) && line.includes(close));
	if (existing !== -1) {
		const indent = lines[existing].slice(0, lines[existing].length - lines[existing].trimStart().length);
		lines[existing] = `${indent}${open}${value}${close}`;
		return lines.join('\n');
	}

	const group = lines.findIndex(line => line.trim().startsWith('<PropertyGroup'));
	if (group === -1) fail(`${element}: no <PropertyGroup> to add it to`);

	lines.splice(group + 1, 0, `    ${open}${value}${close}`);
	return lines.join('\n');
}

function findCsproj(dir) {
	const found = [];
	(function walk(current) {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== 'bin' && entry.name !== 'obj') walk(full);
			} else if (entry.name.endsWith('.csproj')) {
				found.push(full);
			}
		}
	})(dir);
	return found;
}

function copyLicense(dir) {
	const source = path.join(__dirname, '..', 'LICENSE');
	if (!fs.existsSync(source)) fail(`LICENSE not found at ${source}`);
	fs.copyFileSync(source, path.join(dir, 'LICENSE'));
}

function main() {
	const [language, dir] = process.argv.slice(2);

	if (!language || !dir) fail('usage: apply-package-metadata.js <php|python|csharp> <generated-dir>');
	if (!fs.existsSync(dir)) fail(`generated directory does not exist: ${dir}`);

	const handlers = { php: applyPhp, python: applyPython, csharp: applyCsharp };
	const handler = handlers[language];
	if (!handler) fail(`unknown language "${language}" - expected php, python or csharp`);

	const written = handler(dir);
	copyLicense(dir);

	console.log(`apply-package-metadata: ${LICENSE} + ${AUTHOR} written to ${written}`);
}

if (require.main === module) main();

module.exports = { applyPhp, applyPython, applyCsharp, setTomlKey, setMsBuildProperty, setSetupKeyword };
