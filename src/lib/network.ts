import { Networks } from '@stellar/stellar-sdk';

export type StellarNetwork = 'testnet' | 'mainnet';

const rawNetwork = (import.meta.env.VITE_STELLAR_NETWORK || 'testnet').toLowerCase().trim();

export const NETWORK: StellarNetwork = rawNetwork === 'mainnet' ? 'mainnet' : 'testnet';

export const IS_MAINNET = NETWORK === 'mainnet';

export const NETWORK_PASSPHRASE: string = IS_MAINNET
  ? Networks.PUBLIC
  : Networks.TESTNET;

export const FREIGHTER_NETWORK_NAME = IS_MAINNET ? 'PUBLIC' : 'TESTNET';

export const HORIZON_URL =
  (import.meta.env.VITE_STELLAR_HORIZON_URL || '').trim() ||
  (IS_MAINNET
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org');

export const SOROBAN_RPC_URL =
  (import.meta.env.VITE_SOROBAN_RPC_URL || '').trim() ||
  (IS_MAINNET
    ? 'https://mainnet.sorobanrpc.com'
    : 'https://soroban-testnet.stellar.org');

const STELLAR_EXPERT_NETWORK = IS_MAINNET ? 'public' : 'testnet';

export const STELLAR_EXPERT_TX_BASE =
  `https://stellar.expert/explorer/${STELLAR_EXPERT_NETWORK}/tx`;

export const getStellarExpertUrl = (hash: string) =>
  `${STELLAR_EXPERT_TX_BASE}/${hash}`;

/** Human-readable network label for UI display. */
export const NETWORK_LABEL = IS_MAINNET ? 'Stellar Mainnet' : 'Stellar Testnet';

/** Short label for pills and badges. */
export const NETWORK_PILL_LABEL = IS_MAINNET ? 'Mainnet' : 'Testnet';
