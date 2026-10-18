import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'SnowCait/nostter';
const registry = 'https://registry.npmjs.org';
const workflow = '.github/workflows/publish-package.yml';
const versionPattern = '(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)';
const packages = ['nostr-kit', 'nostr-protocol'];

function run(command, args, capture = false) {
	return execFileSync(command, args, {
		encoding: 'utf8',
		stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit'
	})?.trim();
}

const git = (...args) => run('git', args, true);
const jsonFile = (file) => JSON.parse(readFileSync(file, 'utf8'));
const stateFile = () => path.join(process.env.RUNNER_TEMP, 'package-release.json');
const save = (state) => writeFileSync(stateFile(), JSON.stringify(state));
const load = () => jsonFile(stateFile());
const sha = () => git('rev-parse', 'HEAD');

export function parseTag(tag) {
	const match = new RegExp(`^(nostr-kit|nostr-protocol)/v(${versionPattern})$`).exec(tag);
	assert(match && match[0] === tag, 'Expected a stable package version tag');
	return { slug: match[1], version: match[2], name: `@nostter/${match[1]}`, tag };
}

function manifest(slug) {
	assert(packages.includes(slug), 'Unknown package');
	return jsonFile(`packages/${slug}/package.json`);
}

function info(slug) {
	const pkg = manifest(slug);
	const release = parseTag(`${slug}/v${pkg.version}`);
	assert.equal(pkg.name, release.name);
	return release;
}

export async function getJson(url, allowMissing = false, headers = {}) {
	const response = await fetch(url, {
		headers,
		redirect: 'error',
		signal: AbortSignal.timeout(30_000)
	});
	if (allowMissing && response.status === 404) {
		return undefined;
	}
	assert(response.ok, `Request failed: ${response.status} ${url}`);
	return response.json();
}

const github = (endpoint, allowMissing = false) =>
	getJson(`https://api.github.com/repos/${repository}/${endpoint}`, allowMissing, {
		Authorization: `Bearer ${process.env.GH_TOKEN}`,
		Accept: 'application/vnd.github+json'
	});
const published = ({ name, version }) =>
	getJson(`${registry}/${encodeURIComponent(name)}/${version}`, true);
const releaseFor = (tag) => github(`releases/tags/${encodeURIComponent(tag)}`, true);

function tagCommit(tag) {
	const tags = git('tag', '--list', tag);
	return tags ? git('rev-parse', `${tag}^{commit}`) : undefined;
}

function mainContains(commit) {
	git('merge-base', '--is-ancestor', commit, 'origin/main');
}

function assertManifest(release) {
	assert.deepEqual(info(release.slug), release, 'Tag and package metadata differ');
}

export function preparationRun(message, release) {
	assert.equal(message.split('\n')[0], `Release ${release.name} v${release.version}`);
	const ids = [...message.matchAll(/^Package-Release-Run: ([1-9][0-9]*)$/gm)];
	assert.equal(ids.length, 1, 'Missing or ambiguous preparation run');
	return ids[0][1];
}

async function assertPreparation(release) {
	mainContains(sha());
	assertManifest(release);
	const id = preparationRun(git('log', '-1', '--format=%B'), release);
	const preparation = await github(`actions/runs/${id}`);
	assert.equal(preparation.path, '.github/workflows/prepare-package-release.yml');
	assert.equal(preparation.event, 'workflow_dispatch');
	assert.equal(preparation.head_branch, 'main');
	assert.equal(preparation.repository.full_name, repository);
	return id;
}

async function prepare() {
	assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
	const slug = process.env.PACKAGE;
	const bump = process.env.BUMP;
	assert(packages.includes(slug), 'Unknown package');
	assert(['patch', 'minor', 'major'].includes(bump), 'Unknown version increment');
	git('fetch', 'origin', 'main', '--tags');
	git('checkout', '--detach', 'origin/main');
	const previous = findPreparationCommit(process.env.GITHUB_RUN_ID);
	if (previous) {
		git('checkout', '--detach', previous);
		const release = info(slug);
		assert.equal(await assertPreparation(release), process.env.GITHUB_RUN_ID);
		save({ ...release, commit: sha(), resumed: true });
		return;
	}
	// A rerun without a remote checkpoint must never silently select a new version.
	assert.equal(
		process.env.GITHUB_RUN_ATTEMPT,
		'1',
		'No release commit was pushed. Inspect the failed run, then start a new preparation run.'
	);
	const current = info(slug);
	assert(tagCommit(current.tag), 'Current version has no tag; recover its preparation first');
	assert(await published(current), 'Current version is not published; recover it first');
	const currentRelease = await releaseFor(current.tag);
	assert(currentRelease && !currentRelease.draft, 'Finish the current GitHub Release first');
	const parent = sha();
	run('npm', [
		'version',
		bump,
		'-w',
		current.name,
		'--no-git-tag-version',
		'--ignore-scripts',
		'--package-lock-only'
	]);
	run('npm', ['install', '--package-lock-only', '--ignore-scripts']);
	const release = info(slug);
	assert(!tagCommit(release.tag), 'Version tag already exists');
	assert(!(await published(release)), 'npm version already exists');
	assert(!(await releaseFor(release.tag)), 'GitHub Release already exists');
	save({ ...release, parent, resumed: false });
}

export function findPreparationCommit(runId) {
	assert(/^[1-9][0-9]*$/.test(runId), 'Invalid preparation run ID');
	const marker = `Package-Release-Run: ${runId}`;
	const commits = git('log', 'origin/main', '--format=%H', '--fixed-strings', '--grep', marker)
		.split('\n')
		.filter(Boolean)
		.filter((commit) => git('show', '-s', '--format=%B', commit).split('\n').includes(marker));
	assert(commits.length <= 1, 'Multiple release commits for this run');
	return commits[0];
}

function validate() {
	const release = load();
	assertManifest(parseTag(release.tag));
	for (const script of ['build', 'test', 'lint']) {
		run('npm', ['run', script, '-w', release.name]);
	}
	run('npm', ['pack', '-w', release.name, '--pack-destination', process.env.RUNNER_TEMP]);
	const tarball = path.join(
		process.env.RUNNER_TEMP,
		`nostter-${release.slug}-${release.version}.tgz`
	);
	save({ ...release, tarball });
}

async function push() {
	const release = load();
	git('fetch', 'origin', 'main', '--tags');
	// Only the final, short push step receives the App token.
	run('gh', ['auth', 'setup-git']);
	const bot = `${process.env.RELEASE_APP_SLUG}[bot]`;
	const user = JSON.parse(run('gh', ['api', `/users/${bot}`], true));
	git('config', 'user.name', bot);
	git('config', 'user.email', `${user.id}+${bot}@users.noreply.github.com`);
	if (!release.resumed) {
		assert.equal(
			git('rev-parse', 'origin/main'),
			release.parent,
			'main advanced during validation; nothing was pushed. Start a new preparation run.'
		);
		const files = git('diff', '--name-only').split('\n').sort();
		assert.deepEqual(files, ['package-lock.json', `packages/${release.slug}/package.json`]);
		assertManifest(parseTag(release.tag));
		assert(!(await published(release)), 'npm version appeared during preparation');
		assert(!tagCommit(release.tag), 'Tag appeared during preparation');
		git('add', 'package-lock.json', `packages/${release.slug}/package.json`);
		git(
			'commit',
			'-m',
			`Release ${release.name} v${release.version}`,
			'-m',
			`Package-Release-Run: ${process.env.GITHUB_RUN_ID}`
		);
		// A non-fast-forward push fails instead of rebasing or overwriting concurrent changes.
		run('git', ['push', 'origin', 'HEAD:refs/heads/main']);
		git('fetch', 'origin', 'main');
	}
	mainContains(sha());
	const existing = tagCommit(release.tag);
	if (existing) {
		assert.equal(existing, sha(), 'Existing tag points to another commit');
		console.log('Tag already exists. Rerun its Publish package run if recovery is needed.');
		return;
	}
	git('tag', '-a', release.tag, '-m', `${release.name} v${release.version}`);
	run('git', ['push', 'origin', `refs/tags/${release.tag}`]);
}

async function inspect() {
	assert(['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME));
	assert.equal(process.env.GITHUB_REF_TYPE, 'tag');
	assert.equal(process.env.GITHUB_REF_PROTECTED, 'true', 'Package tag rulesets must be active');
	const release = parseTag(process.env.GITHUB_REF_NAME);
	git('fetch', 'origin', 'main', '--tags');
	assert.equal(tagCommit(release.tag), sha());
	assert.equal(sha(), process.env.GITHUB_SHA);
	await assertPreparation(release);
	// Fail closed on registry/GitHub outages before installation or publication.
	const npm = await published(release);
	const existing = await releaseFor(release.tag);
	assert(!existing || npm, 'GitHub Release exists without an npm publication');
	save(release);
}

export function assertProvenance(statement, release, commit, digest) {
	assert.equal(statement._type, 'https://in-toto.io/Statement/v1');
	assert.equal(statement.predicateType, 'https://slsa.dev/provenance/v1');
	assert.deepEqual(statement.subject, [
		{
			name: `pkg:npm/%40nostter/${release.slug}@${release.version}`,
			digest: { sha512: digest }
		}
	]);
	const definition = statement.predicate.buildDefinition;
	assert.equal(
		definition.buildType,
		'https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1'
	);
	assert.deepEqual(definition.externalParameters.workflow, {
		ref: `refs/tags/${release.tag}`,
		repository: `https://github.com/${repository}`,
		path: workflow
	});
	assert(
		definition.resolvedDependencies.some(
			(dependency) =>
				dependency.uri ===
					`git+https://github.com/${repository}@refs/tags/${release.tag}` &&
				dependency.digest.gitCommit === commit
		)
	);
	assert(['push', 'workflow_dispatch'].includes(definition.internalParameters.github.event_name));
	assert.equal(
		statement.predicate.runDetails.builder.id,
		'https://github.com/actions/runner/github-hosted'
	);
}

async function verifyPublication(release, metadata) {
	assert.equal(metadata.name, release.name);
	assert.equal(metadata.version, release.version);
	const bytes = readFileSync(release.tarball);
	const digest = createHash('sha512').update(bytes);
	const hex = digest.digest('hex');
	assert.equal(
		metadata.dist.integrity,
		`sha512-${Buffer.from(hex, 'hex').toString('base64')}`,
		'Published tarball differs from the tagged build'
	);
	const url = new URL(metadata.dist.attestations?.url);
	assert.equal(url.origin, registry);
	const attestations = await getJson(url.href);
	const attestation = attestations.attestations.find(
		(item) => item.predicateType === 'https://slsa.dev/provenance/v1'
	);
	assert(attestation, 'Publication has no supported provenance; stop for manual investigation');
	const bundle = attestation.bundle;
	const bundleFile = path.join(process.env.RUNNER_TEMP, 'npm-provenance.sigstore');
	writeFileSync(bundleFile, JSON.stringify(bundle));
	const identity = `https://github.com/${repository}/${workflow}@refs/tags/${release.tag}`;
	const escapedIdentity = identity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	run('npm', [
		'exec',
		'--yes',
		'--package=@sigstore/cli@0.10.3',
		'--',
		'sigstore',
		'verify',
		bundleFile,
		'--certificate-issuer=https://token.actions.githubusercontent.com',
		`--certificate-identity-uri=^${escapedIdentity}$`
	]);
	const statement = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, 'base64').toString());
	assertProvenance(statement, release, sha(), hex);
}

async function publish() {
	const release = load();
	await assertPreparation(parseTag(release.tag));
	let metadata = await published(release);
	if (!metadata) {
		run('npm', ['publish', release.tarball, '--access', 'public', '--registry', registry]);
		metadata = await published(release);
		assert(metadata, 'Publication is not visible yet; rerun this workflow when it is');
	}
	await verifyPublication(release, metadata);
}

function versionCompare(a, b) {
	const left = a.split('.').map(Number);
	const right = b.split('.').map(Number);
	return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

export function notesForCommits(name, commits) {
	const changes = commits.filter(({ versionOnly }) => !versionOnly);
	return (
		`Changes in ${name}:\n\n` +
		(changes.length
			? changes.map(({ hash, subject }) => `- ${subject} (${hash.slice(0, 8)})`).join('\n')
			: 'No package source or documentation changes since the previous release.')
	);
}

async function createRelease() {
	const release = parseTag(process.env.GITHUB_REF_NAME);
	mainContains(sha());
	assertManifest(release);
	assert.equal(tagCommit(release.tag), sha());
	assert(await published(release), 'npm publication must precede the GitHub Release');
	const existing = await releaseFor(release.tag);
	if (existing) {
		assert.equal(existing.name, `${release.name} v${release.version}`);
		assert(!existing.draft && !existing.prerelease);
		console.log('GitHub Release already exists; no changes made.');
		return;
	}
	const tags = git('tag', '--merged', 'HEAD', '--list', `${release.slug}/v*`)
		.split('\n')
		.filter((tag) => new RegExp(`^${release.slug}/v${versionPattern}$`).test(tag))
		.map(parseTag)
		.filter(({ version }) => versionCompare(version, release.version) < 0)
		.sort((a, b) => versionCompare(b.version, a.version));
	let previous;
	for (const candidate of tags) {
		const priorRelease = await releaseFor(candidate.tag);
		if (priorRelease && !priorRelease.draft && !priorRelease.prerelease) {
			previous = candidate.tag;
			break;
		}
	}
	assert(previous, 'No previous package release found');
	const directory = `packages/${release.slug}/`;
	const range = `${previous}..HEAD`;
	const hashes = git('log', '--no-merges', '--format=%H', range, '--', directory)
		.split('\n')
		.filter(Boolean);
	const commits = hashes.map((hash) => {
		const files = git('diff-tree', '--no-commit-id', '--name-only', '-r', hash, '--', directory)
			.split('\n')
			.filter(Boolean)
			.map((file) => file.slice(directory.length));
		let versionOnly = false;
		if (files.length === 1 && files[0] === 'package.json') {
			const before = JSON.parse(git('show', `${hash}^:${directory}package.json`));
			const after = JSON.parse(git('show', `${hash}:${directory}package.json`));
			delete before.version;
			delete after.version;
			versionOnly = isDeepStrictEqual(before, after);
		}
		return { hash, subject: git('show', '-s', '--format=%s', hash), versionOnly };
	});
	const notes = `${notesForCommits(release.name, commits)}\n`;
	const notesFile = path.join(process.env.RUNNER_TEMP, 'package-release-notes.md');
	writeFileSync(notesFile, notes);
	run('gh', [
		'release',
		'create',
		release.tag,
		'--repo',
		repository,
		'--verify-tag',
		'--title',
		`${release.name} v${release.version}`,
		'--notes-file',
		notesFile,
		'--latest=false'
	]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	assert.equal(process.env.GITHUB_REPOSITORY, repository);
	const commands = { prepare, validate, push, inspect, publish, release: createRelease };
	const command = commands[process.argv[2]];
	assert(command, 'Unknown release operation');
	await command();
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(
			process.env.GITHUB_STEP_SUMMARY,
			`Completed package release operation: ${process.argv[2]}\n`
		);
	}
}
