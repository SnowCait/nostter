import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { name } from './package.json';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
	define: {
		__APP_NAME__: JSON.stringify(name)
	},
	build: {
		target: 'esnext'
	},
	plugins: [sveltekit(), visualizer({ emitFile: true, template: 'sunburst' })],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
