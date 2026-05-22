import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Operation,
  TransactionBuilder,
  xdr
} from '@stellar/stellar-sdk';
import {
  getAddress,
  getNetworkDetails,
  isConnected,
  setAllowed,
  signTransaction
} from '@stellar/freighter-api';
import { logDebug, logError, logInfo } from './logger';
import {
  FREIGHTER_NETWORK_NAME,
  HORIZON_URL,
  NETWORK_PASSPHRASE,
  NETWORK_PILL_LABEL,
  getStellarExpertUrl
} from './network';

type FreighterApiError =
  | string
  | {
      code?: number | string;
      message?: string;
    };

type FreighterSignOptions = {
  network?: string;
  networkPassphrase?: string;
  address?: string;
};

type FreighterSignResult = {
  signedTxXdr?: string;
  signerAddress?: string;
  error?: FreighterApiError;
};

type FreighterTransactionInspection = {
  envelopeType: string;
  operationTypes: string[];
  sorobanAuthTypes: string[];
  localError?: string;
};

export const describeFreighterTransactionXdr = (transactionXdr: string): FreighterTransactionInspection => {
  try {
    const envelope = xdr.TransactionEnvelope.fromXDR(transactionXdr, 'base64');
    const envelopeSwitch = envelope.switch() as { name?: string; value?: number };
    const transaction = TransactionBuilder.fromXDR(transactionXdr, NETWORK_PASSPHRASE) as unknown as {
      operations?: Array<{ type?: string; auth?: xdr.SorobanAuthorizationEntry[] }>;
      innerTransaction?: {
        operations?: Array<{ type?: string; auth?: xdr.SorobanAuthorizationEntry[] }>;
      };
    };
    const operations = transaction.operations || transaction.innerTransaction?.operations || [];

    return {
      envelopeType: envelopeSwitch.name || String(envelopeSwitch.value ?? 'unknown'),
      operationTypes: operations.map((operation) => operation.type || 'unknown'),
      sorobanAuthTypes: operations.flatMap((operation) =>
        (operation.auth || []).map((entry) => {
          const credentialSwitch = entry.credentials().switch() as { name?: string; value?: number };
          return credentialSwitch.name || String(credentialSwitch.value ?? 'unknown');
        })
      )
    };
  } catch (error) {
    return {
      envelopeType: 'unreadable',
      operationTypes: [],
      sorobanAuthTypes: [],
      localError: error instanceof Error ? error.message : String(error)
    };
  }
};

const freighterErrorMessage = (error: FreighterApiError | undefined, fallback: string) => {
  if (!error) return fallback;
  return typeof error === 'string' ? error : error.message || fallback;
};

const formatFreighterError = (
  error: FreighterApiError | undefined,
  fallback: string,
  transactionDetails: FreighterTransactionInspection
) => {
  const message = freighterErrorMessage(error, fallback);

  if (/bad union switch/i.test(message)) {
    if (transactionDetails.localError) {
      return `${message}. The app also could not decode the transaction XDR locally: ${transactionDetails.localError}.`;
    }

    const operations = transactionDetails.operationTypes.join(', ') || 'none';
    const authTypes = transactionDetails.sorobanAuthTypes.join(', ') || 'none';
    return `${message}. PadalaSplit generated a valid ${transactionDetails.envelopeType} XDR locally (${operations}; auth: ${authTypes}). This points to Freighter's extension XDR parser/version rather than the contract or RPC request. Update or reload the Freighter browser extension and retry on ${NETWORK_PILL_LABEL}.`;
  }

  return message;
};

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
  } catch (error) {
    logDebug('freighter.autoConnect', 'Silent Freighter reconnect failed.', { reason: 'non-blocking' });
    logError('freighter.autoConnect', 'Freighter auto-connect threw an error.', error);
    return null;
  }
};

export const connectFreighter = async () => {
  logInfo('freighter.connect', 'Checking Freighter connection.');
  const connected = await isConnected();
  if (connected.error) {
    logError('freighter.connect', 'Freighter connection check returned an error.', connected.error);
    throw new Error(connected.error.message || 'Freighter is unavailable in this browser.');
  }
  if (!connected.isConnected) {
    logInfo('freighter.connect', 'Freighter extension is not connected.');
    throw new Error('Freighter is not installed or is unavailable in this browser.');
  }

  logInfo('freighter.connect', 'Requesting Freighter app access.');
  const allowed = await setAllowed();
  if (allowed.error) {
    logError('freighter.connect', 'Freighter access request returned an error.', allowed.error);
    throw new Error(allowed.error.message || 'Freighter did not allow this app.');
  }
  if (!allowed.isAllowed) {
    logInfo('freighter.connect', 'Freighter access was not granted.');
    throw new Error('Freighter did not allow this app.');
  }

  const addressResult = await getAddress();
  if (typeof addressResult !== 'string' && addressResult.error) {
    logError('freighter.connect', 'Freighter did not return an address.', addressResult.error);
    throw new Error(addressResult.error.message || 'Freighter did not return a public key.');
  }
  const publicKey = typeof addressResult === 'string' ? addressResult : addressResult.address;

  if (!publicKey) {
    logError('freighter.connect', 'Freighter address response was empty.');
    throw new Error('Freighter did not return a public key.');
  }

  logInfo('freighter.connect', 'Freighter connected.', { address: publicKey });
  return publicKey;
};

export const ensureFreighterNetwork = async () => {
  const details = await getNetworkDetails();
  logDebug('freighter.network', 'Read Freighter network details.', {
    network: details.network,
    networkPassphrase: details.networkPassphrase,
    sorobanRpcUrl: details.sorobanRpcUrl
  });

  if (details.error) {
    logError('freighter.network', 'Unable to read Freighter network details.', details.error);
    throw new Error(details.error.message || 'Unable to read Freighter network details.');
  }

  if (details.network && details.network !== FREIGHTER_NETWORK_NAME) {
    logError('freighter.network', 'Freighter is on the wrong network.', undefined, { currentNetwork: details.network });
    throw new Error(`Switch Freighter to ${NETWORK_PILL_LABEL} before signing. Current network: ${details.network}.`);
  }

  if (details.networkPassphrase && details.networkPassphrase !== NETWORK_PASSPHRASE) {
    logError('freighter.network', 'Freighter is using the wrong network passphrase.', undefined, {
      networkPassphrase: details.networkPassphrase
    });
    throw new Error(`Freighter is not using the ${NETWORK_PILL_LABEL} passphrase. Switch Freighter to ${NETWORK_PILL_LABEL} and retry.`);
  }
};

export const signFreighterTransaction = async (transactionXdr: string, address: string) => {
  const transactionDetails = describeFreighterTransactionXdr(transactionXdr);
  logDebug('freighter.sign', 'Prepared transaction for Freighter signing.', {
    address,
    transactionDetails,
    xdrLength: transactionXdr.length,
    xdrPrefix: transactionXdr.slice(0, 48)
  });

  if (transactionDetails.localError) {
    logError('freighter.sign', 'Local XDR inspection failed before Freighter signing.', transactionDetails.localError, {
      transactionDetails
    });
    throw new Error(`PadalaSplit generated unreadable transaction XDR: ${transactionDetails.localError}`);
  }

  await ensureFreighterNetwork();
  const signedResult = (await signTransaction(transactionXdr, {
    address,
    network: FREIGHTER_NETWORK_NAME,
    networkPassphrase: NETWORK_PASSPHRASE
  } as FreighterSignOptions)) as FreighterSignResult | string;

  if (typeof signedResult !== 'string' && signedResult.error) {
    logError('freighter.sign', 'Freighter returned a signing error.', signedResult.error, { transactionDetails });
    throw new Error(formatFreighterError(signedResult.error, 'Freighter declined the transaction.', transactionDetails));
  }

  const signedTxXdr = typeof signedResult === 'string' ? signedResult : signedResult.signedTxXdr;
  if (!signedTxXdr) {
    logError('freighter.sign', 'Freighter returned an empty signed transaction.', undefined, {
      signerAddress: typeof signedResult === 'string' ? undefined : signedResult.signerAddress,
      transactionDetails
    });
    throw new Error('Freighter did not return a signed transaction.');
  }

  logInfo('freighter.sign', 'Freighter signed transaction.', {
    signerAddress: typeof signedResult === 'string' ? address : signedResult.signerAddress || address,
    signedXdrLength: signedTxXdr.length
  });
  return signedTxXdr;
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
  logInfo('stellar.payment', 'Preparing bucket payment.', {
    sourcePublicKey,
    destination,
    amount,
    memo
  });
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(sourcePublicKey);
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE
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

  const signedXdr = await signFreighterTransaction(transaction.toXDR(), sourcePublicKey);
  const signedTransaction = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const response = await server.submitTransaction(signedTransaction);

  logInfo('stellar.payment', 'Bucket payment submitted.', {
    hash: response.hash,
    memo,
    amount
  });

  return {
    hash: response.hash,
    stellarExpertUrl: getStellarExpertUrl(response.hash)
  };
};
