import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  hash,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr
} from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { Buffer } from 'buffer';
import type { BucketRecord, RemittanceRecord } from './types';

const SOROBAN_RPC_URL = import.meta.env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const VAULT_CONTRACT_ID = import.meta.env.VITE_PADALASPLIT_VAULT_CONTRACT_ID || '';

const encoder = new TextEncoder();

export const isSorobanVaultConfigured = () => Boolean(SOROBAN_RPC_URL && VAULT_CONTRACT_ID);

export const getSorobanExpertUrl = (hashValue: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hashValue}`;

export const remittanceContractId = (remittanceId: string) => bytes32Hex(`remittance:${remittanceId}`);

export const bucketContractId = (remittanceId: string, bucketId: string) =>
  bytes32Hex(`bucket:${remittanceId}:${bucketId}`);

export const xlmToStroops = (amount: number) => BigInt(Math.round(amount * 10_000_000));

type VaultBucketSpec = {
  bucketId: string;
  amount: number;
  unlockTimestamp: number;
};

type CreateVaultRemittanceInput = {
  sourcePublicKey: string;
  recipient: string;
  remittanceId: string;
  buckets: VaultBucketSpec[];
};

type WithdrawVaultBucketInput = {
  sourcePublicKey: string;
  remittanceId: string;
  bucketId: string;
};

export const createVaultRemittance = async ({
  sourcePublicKey,
  recipient,
  remittanceId,
  buckets
}: CreateVaultRemittanceInput) => {
  const result = await submitVaultCall(sourcePublicKey, 'create_remittance', [
    new Address(sourcePublicKey).toScVal(),
    new Address(recipient).toScVal(),
    bytes32ScVal(remittanceContractId(remittanceId)),
    bucketSpecsToScVal(buckets)
  ]);

  return {
    hash: result.hash,
    stellarExpertUrl: getSorobanExpertUrl(result.hash)
  };
};

export const withdrawVaultBucket = async ({
  sourcePublicKey,
  remittanceId,
  bucketId
}: WithdrawVaultBucketInput) => {
  const result = await submitVaultCall(sourcePublicKey, 'withdraw', [
    new Address(sourcePublicKey).toScVal(),
    bytes32ScVal(remittanceContractId(remittanceId)),
    bytes32ScVal(bucketContractId(remittanceId, bucketId))
  ]);

  return {
    hash: result.hash,
    stellarExpertUrl: getSorobanExpertUrl(result.hash)
  };
};

export const readVaultBucket = async (remittanceId: string, bucketId: string) => {
  const tx = await buildVaultTransaction(undefined, 'get_bucket', [
    bytes32ScVal(remittanceContractId(remittanceId)),
    bytes32ScVal(bucketContractId(remittanceId, bucketId))
  ]);
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const simulation = await server.simulateTransaction(tx);

  if ('error' in simulation) {
    throw new Error(simulation.error);
  }

  const returnValue = simulation.result?.retval;
  if (!returnValue) {
    throw new Error('Vault bucket was not returned by Soroban RPC.');
  }

  return scValToNative(returnValue) as {
    amount: bigint;
    claimed: boolean;
    recipient: string;
    sender: string;
    unlock_time: bigint;
  };
};

export const applyVaultMetadata = (remittance: RemittanceRecord, result: { hash: string; stellarExpertUrl: string }) => ({
  ...remittance,
  status: 'completed' as const,
  vaultContractId: VAULT_CONTRACT_ID,
  vaultTransactionHash: result.hash,
  vaultExpertUrl: result.stellarExpertUrl,
  buckets: remittance.buckets.map((bucket) => ({
    ...bucket,
    contractBucketId: bucketContractId(remittance.id, bucket.id),
    paymentStatus:
      bucket.unlockTimestamp && bucket.unlockTimestamp <= Math.floor(Date.now() / 1000)
        ? ('withdrawable' as const)
        : ('vaulted' as const),
    transactionHash: result.hash,
    stellarExpertUrl: result.stellarExpertUrl
  }))
});

export const bucketToVaultSpec = (remittanceId: string, bucket: BucketRecord): VaultBucketSpec => ({
  bucketId: bucketContractId(remittanceId, bucket.id),
  amount: bucket.amount,
  unlockTimestamp: bucket.unlockTimestamp || Math.floor(Date.now() / 1000)
});

const submitVaultCall = async (sourcePublicKey: string, method: string, args: xdr.ScVal[]) => {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const tx = await buildVaultTransaction(sourcePublicKey, method, args);
  const prepared = await server.prepareTransaction(tx);
  const signedResult = await signTransaction(prepared.toXDR(), {
    address: sourcePublicKey,
    networkPassphrase: Networks.TESTNET
  });

  if (signedResult.error) {
    throw new Error(signedResult.error.message || 'Freighter declined the Soroban transaction.');
  }

  const signedTransaction = TransactionBuilder.fromXDR(signedResult.signedTxXdr, Networks.TESTNET);
  const sendResult = await server.sendTransaction(signedTransaction);

  if (sendResult.status === 'ERROR') {
    throw new Error('Soroban RPC rejected the transaction.');
  }

  return waitForSorobanTransaction(server, sendResult.hash);
};

const waitForSorobanTransaction = async (server: rpc.Server, txHash: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await server.getTransaction(txHash);

    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash: txHash };
    }

    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Soroban transaction failed on-chain.');
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  throw new Error('Timed out waiting for Soroban transaction confirmation.');
};

const buildVaultTransaction = async (sourcePublicKey: string | undefined, method: string, args: xdr.ScVal[]) => {
  if (!VAULT_CONTRACT_ID) {
    throw new Error('VITE_PADALASPLIT_VAULT_CONTRACT_ID is not configured.');
  }

  const server = new rpc.Server(SOROBAN_RPC_URL);
  const sourceAccount = sourcePublicKey
    ? await server.getAccount(sourcePublicKey)
    : await server.getAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
  const vault = new Contract(VAULT_CONTRACT_ID);

  return new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(vault.call(method, ...args))
    .setTimeout(60)
    .build();
};

const bucketSpecsToScVal = (buckets: VaultBucketSpec[]) =>
  xdr.ScVal.scvVec(
    buckets.map((bucket) =>
      xdr.ScVal.scvMap([
        scMapEntry('bucket_id', bytes32ScVal(bucket.bucketId)),
        scMapEntry('amount', nativeToScVal(xlmToStroops(bucket.amount), { type: 'i128' })),
        scMapEntry('unlock_time', nativeToScVal(bucket.unlockTimestamp, { type: 'u64' }))
      ])
    )
  );

const scMapEntry = (key: string, val: xdr.ScVal) =>
  new xdr.ScMapEntry({
    key: nativeToScVal(key, { type: 'symbol' }),
    val
  });

const bytes32ScVal = (hex: string) => xdr.ScVal.scvBytes(hexToBytes(hex));

const bytes32Hex = (value: string) => Buffer.from(hash(Buffer.from(encoder.encode(value)))).toString('hex');

const hexToBytes = (hex: string) => Buffer.from(hex, 'hex');
