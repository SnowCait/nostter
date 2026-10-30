import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { visualizer } from 'rollup-plugin-visualizer';

// SvelteKit overrides build.cssMinify in its pre config hook, so reapply it afterward.
const esbuildCssMinifier = {
	name: 'esbuild-css-minifier',
	config: () => ({ build: { cssMinify: 'esbuild' as const } })
};

export default defineConfig(({ mode }) => ({
	resolve: { conditions: mode === 'test' ? ['browser'] : undefined },
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
		environmentOptions: {
			happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: true } }
		},
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
}));
