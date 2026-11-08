/// <reference types="vite/client" />

// Typed environment variables (set them in a .env.local file).
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
