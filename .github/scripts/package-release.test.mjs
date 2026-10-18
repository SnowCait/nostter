import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
	assertProvenance,
	findPreparationCommit,
	getJson,
	notesForCommits,
	parseTag,
	preparationRun
} from './package-release.mjs';

test('only an explicit 404 permits treating a registry version as absent', async () => {
	const originalFetch = globalThis.fetch;
	try {
		globalThis.fetch = async () => new Response('', { status: 404 });
		assert.equal(await getJson('https://registry.npmjs.org/test', true), undefined);
		globalThis.fetch = async () => new Response('', { status: 503 });
		await assert.rejects(getJson('https://registry.npmjs.org/test', true));
		globalThis.fetch = async () => {
			throw new TypeError('Network unavailable');
		};
		await assert.rejects(getJson('https://registry.npmjs.org/test', true));
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test('only stable versions of the two release packages can be selected', () => {
	assert.equal(parseTag('nostr-kit/v0.1.1').name, '@nostter/nostr-kit');
	assert.equal(parseTag('nostr-protocol/v1.0.0').version, '1.0.0');
	for (const tag of [
		'v0.1.1',
		'web/v1.0.0',
		'nostr-kit/v01.0.0',
		'nostr-kit/v1.0.0-beta',
		'nostr-kit/v1.0.0;echo test',
		'nostr-kit/v1.0.0\n'
	]) {
		assert.throws(() => parseTag(tag));
	}
});

test('release commits must identify exactly one preparation run and the matching version', () => {
	const release = parseTag('nostr-kit/v0.1.1');
	const message = 'Release @nostter/nostr-kit v0.1.1\n\nPackage-Release-Run: 123';
	assert.equal(preparationRun(message, release), '123');
	assert.throws(() => preparationRun(message.replace('0.1.1', '0.1.2'), release));
	assert.throws(() => preparationRun(message + '\nPackage-Release-Run: 456', release));
});

test('recovery finds the same main commit after later releases and rejects ambiguous checkpoints', () => {
	const cwd = process.cwd();
	const directory = mkdtempSync(path.join(os.tmpdir(), 'nostter-release-test-'));
	const git = (...args) =>
		execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
	try {
		process.chdir(directory);
		git('init');
		git('config', 'user.name', 'Release test');
		git('config', 'user.email', 'release@example.com');
		git('commit', '--allow-empty', '-m', 'Release package', '-m', 'Package-Release-Run: 123');
		const checkpoint = git('rev-parse', 'HEAD');
		git('commit', '--allow-empty', '-m', 'Later release', '-m', 'Package-Release-Run: 1234');
		git('update-ref', 'refs/remotes/origin/main', 'HEAD');
		assert.equal(findPreparationCommit('123'), checkpoint);
		assert.equal(findPreparationCommit('999'), undefined);
		git('commit', '--allow-empty', '-m', 'Duplicate marker', '-m', 'Package-Release-Run: 123');
		git('update-ref', 'refs/remotes/origin/main', 'HEAD');
		assert.throws(() => findPreparationCommit('123'));
	} finally {
		process.chdir(cwd);
		rmSync(directory, { recursive: true });
	}
});

function provenance(release) {
	return {
		_type: 'https://in-toto.io/Statement/v1',
		subject: [
			{
				name: `pkg:npm/%40nostter/${release.slug}@${release.version}`,
				digest: { sha512: 'digest' }
			}
		],
		predicateType: 'https://slsa.dev/provenance/v1',
		predicate: {
			buildDefinition: {
				buildType: 'https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1',
				externalParameters: {
					workflow: {
						ref: `refs/tags/${release.tag}`,
						repository: 'https://github.com/SnowCait/nostter',
						path: '.github/workflows/publish-package.yml'
					}
				},
				internalParameters: { github: { event_name: 'push' } },
				resolvedDependencies: [
					{
						uri: `git+https://github.com/SnowCait/nostter@refs/tags/${release.tag}`,
						digest: { gitCommit: 'commit' }
					}
				]
			},
			runDetails: { builder: { id: 'https://github.com/actions/runner/github-hosted' } }
		}
	};
}

test('publication recovery binds provenance to the package bytes, tag, workflow, and source commit', () => {
	const release = parseTag('nostr-protocol/v0.2.0');
	assertProvenance(provenance(release), release, 'commit', 'digest');
	assert.throws(() => assertProvenance(provenance(release), release, 'other-commit', 'digest'));
	assert.throws(() => assertProvenance(provenance(release), release, 'commit', 'other-digest'));
	for (const replacement of [
		{ ref: 'refs/heads/main' },
		{ repository: 'https://github.com/other/nostter' },
		{ path: '.github/workflows/another-publish.yml' }
	]) {
		const statement = provenance(release);
		Object.assign(statement.predicate.buildDefinition.externalParameters.workflow, replacement);
		assert.throws(() => assertProvenance(statement, release, 'commit', 'digest'));
	}
});

test('notes omit version-only commits while keeping other package manifest changes', () => {
	const notes = notesForCommits('@nostter/nostr-kit', [
		{ hash: 'a'.repeat(40), subject: 'Release @nostter/nostr-kit v0.1.1', versionOnly: true },
		{ hash: 'b'.repeat(40), subject: 'Update relay validation', versionOnly: false },
		{ hash: 'c'.repeat(40), subject: 'Update package dependencies', versionOnly: false }
	]);
	assert(!notes.includes('Release @nostter/nostr-kit v0.1.1'));
	assert(notes.includes('Update relay validation'));
	assert(notes.includes('Update package dependencies'));
});
