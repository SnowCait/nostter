import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const workflow = await readFile(
	new URL('../workflows/ui-screenshot-diff.yml', import.meta.url),
	'utf8'
);
const script = workflow
	.slice(workflow.lastIndexOf('          script: |') + '          script: |'.length)
	.split('\n')
	.map((l) => l.slice(12))
	.join('\n');
const execute = new (Object.getPrototypeOf(async function () {}).constructor)(
	'github',
	'context',
	'process',
	script
);
async function run({ changes = [], existing = true, head = 'abc', newer = false } = {}) {
	const calls = [];
	const issues = Object.fromEntries(
		['deleteComment', 'updateComment', 'createComment'].map((method) => [
			method,
			async () => calls.push(method)
		])
	);
	const github = {
		rest: {
			issues,
			pulls: { get: async () => ({ data: { state: 'open', head: { sha: head } } }) },
			actions: { listWorkflowRuns: 'runs' }
		},
		paginate: async (method) =>
			method === 'runs'
				? newer
					? [{ id: 2 }]
					: []
				: existing
					? [
							{
								id: 3,
								user: { login: 'github-actions[bot]' },
								body: '<!-- nostter-ui-screenshots -->'
							}
						]
					: []
	};
	await execute(
		github,
		{
			repo: { owner: 'owner', repo: 'repo' },
			payload: { workflow_run: { id: 1, run_attempt: 1 } }
		},
		{
			env: {
				PR: '1',
				HEAD: 'abc',
				BASE_SHA: 'base',
				BASE_RUN: '10',
				CHANGES: JSON.stringify(changes),
				ARTIFACT: 'https://github.com/artifact'
			}
		}
	);
	return calls;
}
test('notifies only differences, updates one comment and removes resolved differences', async () => {
	const changes = [{ file: 'login/top.desktop.png', kind: 'changed' }];
	assert.deepEqual(await run({ existing: false }), []);
	assert.deepEqual(await run({ existing: false, changes }), ['createComment']);
	assert.deepEqual(await run({ changes }), ['updateComment']);
	assert.deepEqual(await run(), ['deleteComment']);
	assert.deepEqual(await run({ head: 'new' }), []);
	assert.deepEqual(await run({ newer: true }), []);
});
