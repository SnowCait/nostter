import path from 'node:path';
import { loadConfig } from '@sveltejs/load-config';
import svelte from 'eslint-plugin-svelte';
import commonConfig, {
	defineConfig,
	includeIgnoreFile,
	typescriptParser
} from '../eslint.config.mjs';

const svelteConfig = (await loadConfig('./', { traverse: false }))?.config;

export default defineConfig([
	includeIgnoreFile(path.resolve(import.meta.dirname, '.gitignore'), {
		gitignoreResolution: true
	}),
	commonConfig,
	svelte.configs.recommended,
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: typescriptParser,
				svelteConfig
			}
		}
	},
	{
		rules: {
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/require-each-key': 'off',
			'svelte/prefer-svelte-reactivity': 'off'
		}
	}
]);
