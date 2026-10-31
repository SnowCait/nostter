import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/screenshot-comparison',
	outputDir: 'test-results/ui-diff',
	snapshotPathTemplate: '{testDir}/../../test-results/ui-baseline/{arg}{ext}',
	updateSnapshots: 'none',
	reporter: [['html', { outputFolder: 'test-results/ui-report', open: 'never' }]]
});
