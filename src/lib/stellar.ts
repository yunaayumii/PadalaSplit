import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Networks,
  Operation,
  TransactionBuilder
} from '@stellar/stellar-sdk';
import {
  getAddress,
  isConnected,
  setAllowed,
  signTransaction
} from '@stellar/freighter-api';

const HORIZON_URL = import.meta.env.VITE_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

export const STELLAR_EXPERT_TESTNET_BASE = 'https://stellar.expert/explorer/testnet/tx';

export const getStellarExpertUrl = (hash: string) => `${STELLAR_EXPERT_TESTNET_BASE}/${hash}`;

/**
 * Attempt to silently restore a Freighter connection without showing
 * any popups. Returns the public key if Freighter is installed and
 * the app was previously allowed; returns null otherwise.
 */
export const tryAutoConnect = async (): Promise<string | null> => {
  try {
    const connected = await isConnected();
    if (connected.error || !connected.isConnected) return null;

    const addressResult = await getAddress();
    if (typeof addressResult === 'string') return addressResult || null;
    if (addressResult.error) return null;
    return addressResult.address || null;
  } catch {
    return null;
  }
};

export const connectFreighter = async () => {
  const connected = await isConnected();
  if (connected.error) {
    throw new Error(connected.error.message || 'Freighter is unavailable in this browser.');
  }
  if (!connected.isConnected) {
    throw new Error('Freighter is not installed or is unavailable in this browser.');
  }

  const allowed = await setAllowed();
  if (allowed.error) {
    throw new Error(allowed.error.message || 'Freighter did not allow this app.');
  }
  if (!allowed.isAllowed) {
    throw new Error('Freighter did not allow this app.');
  }

  const addressResult = await getAddress();
  if (typeof addressResult !== 'string' && addressResult.error) {
    throw new Error(addressResult.error.message || 'Freighter did not return a public key.');
  }
  const publicKey = typeof addressResult === 'string' ? addressResult : addressResult.address;

  if (!publicKey) {
    throw new Error('Freighter did not return a public key.');
  }

  return publicKey;
};

export const submitBucketPayment = async ({
  sourcePublicKey,
  destination,
  amount,
  memo
}: {
  sourcePublicKey: string;
  destination: string;
  amount: number;
  memo: string;
}) => {
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(sourcePublicKey);
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: Asset.native(),
        amount: amount.toFixed(7)
      })
    )
    .addMemo(Memo.text(memo.slice(0, 28)))
    .setTimeout(60)
    .build();

  const signedResult = await signTransaction(transaction.toXDR(), {
    address: sourcePublicKey,
    networkPassphrase: Networks.TESTNET
  });
  if (typeof signedResult !== 'string' && signedResult.error) {
    throw new Error(signedResult.error.message || 'Freighter declined the transaction.');
  }
  const signedXdr = typeof signedResult === 'string' ? signedResult : signedResult.signedTxXdr;
  const signedTransaction = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  const response = await server.submitTransaction(signedTransaction);

  return {
    hash: response.hash,
    stellarExpertUrl: getStellarExpertUrl(response.hash)
  };
};
