declare const __APP_NAME__: string;

interface ViteTypeOptions {
	strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
	readonly VITE_DEFAULT_RELAYS?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
