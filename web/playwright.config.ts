import type { PlaywrightTestConfig } from '@playwright/test';
import { e2eRelayUrl } from './tests/e2e-relay-url';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		timeout: 300000,
		env: {
			VITE_DEFAULT_RELAYS: e2eRelayUrl,
			VITE_METADATA_RELAYS: e2eRelayUrl
		}
	},
	use: {
		baseURL: 'http://localhost:4173',
		locale: 'en-US'
	},
	testDir: 'tests'
};

export default config;
