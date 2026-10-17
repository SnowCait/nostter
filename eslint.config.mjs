import path from 'node:path';
import js from '@eslint/js';
import { importX } from 'eslint-plugin-import-x';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

export { defineConfig, includeIgnoreFile };
export const typescriptParser = ts.parser;

export default defineConfig([
	includeIgnoreFile(path.resolve(import.meta.dirname, '.gitignore'), {
		gitignoreResolution: true
	}),
	js.configs.recommended,
	ts.configs.recommended,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint recommends disabling no-undef for TypeScript; the JavaScript override below enables it there.
			// See: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			curly: 'error'
		}
	},
	{
		files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
		ignores: ['**/*.svelte.js'],
		rules: { 'no-undef': 'error' }
	},
	{
		plugins: { 'import-x': importX },
		rules: { 'import-x/no-extraneous-dependencies': 'error' }
	}
]);
