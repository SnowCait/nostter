import path from 'node:path';
import svelte from 'eslint-plugin-svelte';
import commonConfig, {
	defineConfig,
	includeIgnoreFile,
	typescriptParser
} from '../eslint.config.mjs';
import svelteConfig from './svelte.config.js';

export default defineConfig([
	includeIgnoreFile(path.resolve(import.meta.dirname, '.gitignore')),
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
