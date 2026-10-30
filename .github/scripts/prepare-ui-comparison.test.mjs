import { test } from 'node:test';
import assert from 'node:assert/strict';
import prepare from './prepare-ui-comparison.cjs';
async function run({
	baseline = true,
	expired = false,
	conclusion = 'success',
	head = 'abc'
} = {}) {
	const outputs = {};
	const github = {
		paginate: async (method) =>
			method === 'pulls'
				? [{ number: 7, head: { sha: head, repo: { id: 1 } } }]
				: [{ name: 'ui-screenshots', expired }],
		rest: {
			pulls: { list: 'pulls' },
			actions: {
				listWorkflowRunArtifacts: 'artifacts',
				listWorkflowRuns: async () => ({
					data: { workflow_runs: baseline ? [{ id: 9, head_sha: 'base' }] : [] }
				})
			}
		}
	};
	await prepare({
		github,
		context: {
			repo: { owner: 'owner', repo: 'repo' },
			payload: {
				workflow_run: {
					id: 10,
					conclusion,
					head_sha: 'abc',
					head_branch: 'feature',
					head_repository: { id: 1, owner: { login: 'fork' } }
				}
			}
		},
		core: { info: () => {}, setOutput: (key, value) => (outputs[key] = value) }
	});
	return outputs;
}
test('selects a successful main baseline and rejects unavailable or stale results', async () => {
	assert.deepEqual(await run(), { pr: '7', head: 'abc', baseline: '9', sha: 'base' });
	await assert.rejects(run({ baseline: false }), /baseline/);
	await assert.rejects(run({ expired: true }), /artifact/);
	await assert.rejects(run({ conclusion: 'failure' }), /succeed/);
	await assert.rejects(run({ head: 'new' }), /current PR/);
});
