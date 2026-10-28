import { sveltekit } from '@sveltejs/kit/vite';
import { configDefaults, defineConfig } from 'vitest/config';
import { visualizer } from 'rollup-plugin-visualizer';

// SvelteKit overrides build.cssMinify in its pre config hook, so reapply it afterward.
const esbuildCssMinifier = {
	name: 'esbuild-css-minifier',
	config: () => ({ build: { cssMinify: 'esbuild' as const } })
};

export default defineConfig({
	build: {
		minify: 'esbuild',
		sourcemap: true
	},
	define: {
		__GIT_SHA__: JSON.stringify(process.env.WORKERS_CI_COMMIT_SHA ?? '')
	},
	plugins: [
		sveltekit(),
		esbuildCssMinifier,
		visualizer({ emitFile: true, template: 'markdown' })
	],
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: [...configDefaults.exclude, 'src/**/*.dom.test.ts']
				}
			},
			{
				extends: true,
				resolve: { conditions: ['browser'] },
				test: { name: 'dom', environment: 'happy-dom', include: ['src/**/*.dom.test.ts'] }
			}
		]
	}
});
