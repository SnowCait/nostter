module.exports = async ({ github, context, core }) => {
	const run = context.payload.workflow_run;
	const { owner, repo } = context.repo;
	if (run.conclusion !== 'success') {
		throw new Error('Test workflow did not succeed');
	}
	const prs = await github.paginate(github.rest.pulls.list, {
		owner,
		repo,
		state: 'open',
		head: `${run.head_repository.owner.login}:${run.head_branch}`
	});
	const pr = prs.find(
		(p) => p.head.sha === run.head_sha && p.head.repo.id === run.head_repository.id
	);
	if (!pr) {
		throw new Error('No current PR matches this run');
	}
	const runs = await github.rest.actions.listWorkflowRuns({
		owner,
		repo,
		workflow_id: 'test.yml',
		branch: 'main',
		event: 'push',
		status: 'success',
		per_page: 1
	});
	const baseline = runs.data.workflow_runs[0];
	if (!baseline) {
		throw new Error('No successful main baseline');
	}
	core.info(`Baseline: ${baseline.head_sha}, run ${baseline.id}`);
	for (const [name, id] of [
		['before', baseline.id],
		['after', run.id]
	]) {
		const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
			owner,
			repo,
			run_id: id
		});
		if (!artifacts.some((a) => a.name === 'ui-screenshots' && !a.expired)) {
			throw new Error(`Missing ${name} artifact`);
		}
	}
	for (const [key, value] of Object.entries({
		pr: pr.number,
		head: pr.head.sha,
		baseline: baseline.id,
		sha: baseline.head_sha
	})) {
		core.setOutput(key, String(value));
	}
};
