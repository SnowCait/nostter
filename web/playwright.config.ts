import { devices, type PlaywrightTestConfig } from '@playwright/test';
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
	projects: [
		{ name: 'e2e', testIgnore: 'screenshots/**' },
		{
			name: 'screenshots-desktop',
			testMatch: 'screenshots/**/*.test.ts',
			use: {
				browserName: 'chromium',
				viewport: { width: 1280, height: 800 },
				colorScheme: 'light'
			}
		},
		{
			name: 'screenshots-mobile',
			testMatch: 'screenshots/**/*.test.ts',
			use: { ...devices['Pixel 5'], locale: 'en-US', colorScheme: 'light' }
		}
	],
	testDir: 'tests'
};

export default config;
