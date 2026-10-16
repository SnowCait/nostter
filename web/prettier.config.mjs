import * as sveltePlugin from 'prettier-plugin-svelte';
import commonConfig from '../prettier.config.mjs';

export default {
	...commonConfig,
	plugins: [sveltePlugin],
	overrides: [
		{
			files: '*.svelte',
			options: {
				parser: 'svelte'
			}
		}
	]
};
