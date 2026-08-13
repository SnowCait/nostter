import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { name } from './package.json' with { type: 'json' };
import { visualizer } from 'rollup-plugin-visualizer';

const esbuildCssMinifier = {
	name: 'esbuild-css-minifier',
	config: () => ({ build: { cssMinify: 'esbuild' as const } })
};

export default defineConfig({
	define: {
		__APP_NAME__: JSON.stringify(name)
	},
	build: {
		target: 'esnext'
	},
	plugins: [
		sveltekit(),
		esbuildCssMinifier,
		visualizer({ emitFile: true, template: 'markdown' })
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
