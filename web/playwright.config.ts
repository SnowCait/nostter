import type { PlaywrightTestConfig } from '@playwright/test';

const relayUrl = new URL(process.env.E2E_RELAY_URL || 'ws://127.0.0.1:8080/');

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		timeout: 300000,
		env: {
			VITE_DEFAULT_RELAYS: relayUrl.href,
			VITE_METADATA_RELAYS: relayUrl.href
		}
	},
	use: {
		baseURL: 'http://localhost:4173',
		locale: 'en-US'
	},
	testDir: 'tests'
};

export default config;
