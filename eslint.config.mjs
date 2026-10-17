import path from 'node:path';
import js from '@eslint/js';
import { importX } from 'eslint-plugin-import-x';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

export { defineConfig, includeIgnoreFile };
export const typescriptParser = ts.parser;

export default defineConfig([
	includeIgnoreFile(path.resolve(import.meta.dirname, '.gitignore')),
	js.configs.recommended,
	ts.configs.recommended,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// TypeScript handles undefined names; preserve the existing rule for JavaScript too.
			'no-undef': 'off',
			curly: 'error'
		}
	},
	{
		plugins: { 'import-x': importX },
		rules: { 'import-x/no-extraneous-dependencies': 'error' }
	}
]);
