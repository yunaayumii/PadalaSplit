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

export const connectFreighter = async () => {
  const connected = await isConnected();
  if (!connected) {
    throw new Error('Freighter is not installed or is unavailable in this browser.');
  }

  await setAllowed();
  const addressResult = await getAddress();
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
  const signedXdr = typeof signedResult === 'string' ? signedResult : signedResult.signedTxXdr;
  const signedTransaction = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  const response = await server.submitTransaction(signedTransaction);

  return {
    hash: response.hash,
    stellarExpertUrl: getStellarExpertUrl(response.hash)
  };
};
