/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_RECIPIENT_ADDRESS?: string;
  readonly VITE_PADALASPLIT_VAULT_CONTRACT_ID?: string;
  readonly VITE_SOROBAN_RPC_URL?: string;
  readonly VITE_STELLAR_HORIZON_URL?: string;
  readonly VITE_STELLAR_NETWORK?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
