import adapter from '@sveltejs/adapter-auto';
import preprocess from 'svelte-preprocess';
//import { vitePreprocess } from '@sveltejs/kit/vite';

const tagsRegex1 = /(>)[\s]*([<{])/g;
const tagsRegex2 = /({[/:][a-z]+})[\s]*([<{])/g;
const tagsRegex3 = /({[#:][a-z]+ .+?})[\s]*([<{])/g;
const tagsRegex4 = /([>}])[\s]+(<|{[/#:][a-z][^}]*})/g;
const tagsReplace = '$1$2';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	//  preprocess: [vitePreprocess()]
	preprocess: preprocess({
		replace: [
			[tagsRegex1, tagsReplace],
			[tagsRegex2, tagsReplace],
			[tagsRegex3, tagsReplace],
			[tagsRegex4, tagsReplace]
		]
	}),
	kit: {
		adapter: adapter()
	}
};

export default config;
