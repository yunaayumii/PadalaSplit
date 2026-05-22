import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  hash,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr
} from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';
import { logDebug, logError, logInfo, logWarn } from './logger';
import {
  NETWORK_PASSPHRASE,
  NETWORK_PILL_LABEL,
  SOROBAN_RPC_URL,
  getStellarExpertUrl
} from './network';
import { describeFreighterTransactionXdr, signFreighterTransaction } from './stellar';
import type { BucketRecord, RemittanceRecord } from './types';

const VAULT_CONTRACT_ID = import.meta.env.VITE_PADALASPLIT_VAULT_CONTRACT_ID || '';

const encoder = new TextEncoder();

export const isSorobanVaultConfigured = () => Boolean(SOROBAN_RPC_URL && VAULT_CONTRACT_ID);

export const getSorobanExpertUrl = (hashValue: string) =>
  getStellarExpertUrl(hashValue);

export const remittanceContractId = (remittanceId: string) => bytes32Hex(`remittance:${remittanceId}`);

export const bucketContractId = (remittanceId: string, bucketId: string) =>
  bytes32Hex(`bucket:${remittanceId}:${bucketId}`);

export const xlmToStroops = (amount: number) => BigInt(Math.round(amount * 10_000_000));

type VaultBucketSpec = {
  bucketId: string;
  amount: number;
  unlockTimestamp: number;
};

export type VaultProgressPhase = 'preparing' | 'signing' | 'submitted' | 'confirming';

export type VaultProgressUpdate = {
  phase: VaultProgressPhase;
  message: string;
  hash?: string;
};

type CreateVaultRemittanceInput = {
  sourcePublicKey: string;
  recipient: string;
  remittanceId: string;
  buckets: VaultBucketSpec[];
  onProgress?: (update: VaultProgressUpdate) => void;
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
  buckets,
  onProgress
}: CreateVaultRemittanceInput) => {
  logInfo('soroban.createVault', 'Starting vault remittance creation.', {
    sourcePublicKey,
    recipient,
    remittanceId,
    bucketCount: buckets.length,
    totalAmount: buckets.reduce((sum, bucket) => sum + bucket.amount, 0)
  });

  const result = await submitVaultCall(
    sourcePublicKey,
    'create_remittance',
    [
      new Address(sourcePublicKey).toScVal(),
      new Address(recipient).toScVal(),
      bytes32ScVal(remittanceContractId(remittanceId)),
      bucketSpecsToScVal(buckets)
    ],
    onProgress
  );

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
  logInfo('soroban.withdraw', 'Starting vault bucket withdrawal.', {
    sourcePublicKey,
    remittanceId,
    bucketId
  });

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
  logDebug('soroban.readBucket', 'Reading vault bucket from contract.', { remittanceId, bucketId });
  const tx = await buildVaultTransaction(undefined, 'get_bucket', [
    bytes32ScVal(remittanceContractId(remittanceId)),
    bytes32ScVal(bucketContractId(remittanceId, bucketId))
  ]);
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const simulation = await server.simulateTransaction(tx);

  if ('error' in simulation) {
    logError('soroban.readBucket', 'Soroban bucket read simulation failed.', simulation.error, { remittanceId, bucketId });
    throw new Error(simulation.error);
  }

  const returnValue = simulation.result?.retval;
  if (!returnValue) {
    logError('soroban.readBucket', 'Soroban bucket read returned no value.', undefined, { remittanceId, bucketId });
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

export const applyVaultMetadata = (
  remittance: RemittanceRecord,
  result?: { hash: string; stellarExpertUrl: string }
) => ({
  ...remittance,
  status: 'completed' as const,
  vaultContractId: VAULT_CONTRACT_ID,
  vaultTransactionHash: result?.hash || remittance.vaultTransactionHash,
  vaultExpertUrl: result?.stellarExpertUrl || remittance.vaultExpertUrl,
  buckets: remittance.buckets.map((bucket) => ({
    ...bucket,
    contractBucketId: bucketContractId(remittance.id, bucket.id),
    paymentStatus:
      bucket.unlockTimestamp && bucket.unlockTimestamp <= Math.floor(Date.now() / 1000)
        ? ('withdrawable' as const)
        : ('vaulted' as const),
    transactionHash: result?.hash || bucket.transactionHash,
    stellarExpertUrl: result?.stellarExpertUrl || bucket.stellarExpertUrl,
    error: undefined
  }))
});

export const bucketToVaultSpec = (remittanceId: string, bucket: BucketRecord): VaultBucketSpec => ({
  bucketId: bucketContractId(remittanceId, bucket.id),
  amount: bucket.amount,
  unlockTimestamp: bucket.unlockTimestamp || Math.floor(Date.now() / 1000)
});

/**
 * Recover a remittance's vault status by reading each bucket directly
 * from the Soroban contract. Useful when the app record was corrupted
 * (e.g. page refresh during vault creation) but the on-chain vault
 * still exists.
 */
export const recoverVaultRemittance = async (
  remittance: RemittanceRecord
): Promise<RemittanceRecord> => {
  if (!VAULT_CONTRACT_ID) {
    throw new Error('Soroban vault contract is not configured.');
  }

  let recovered = { ...remittance };
  let anyFound = false;

  for (const bucket of remittance.buckets) {
    try {
      const vaultBucket = await readVaultBucket(remittance.id, bucket.id);
      const unlockTime = Number(vaultBucket.unlock_time);
      const isWithdrawn = vaultBucket.claimed;
      const canWithdrawNow = !isWithdrawn && unlockTime <= Math.floor(Date.now() / 1000);

      recovered = {
        ...recovered,
        buckets: recovered.buckets.map((candidate) =>
          candidate.id === bucket.id
            ? {
              ...candidate,
              contractBucketId: bucketContractId(remittance.id, bucket.id),
              unlockTimestamp: unlockTime,
              paymentStatus: isWithdrawn
                ? ('withdrawn' as const)
                : canWithdrawNow
                  ? ('withdrawable' as const)
                  : ('vaulted' as const),
              error: undefined
            }
            : candidate
        )
      };
      anyFound = true;
    } catch (error) {
      logWarn('soroban.recover', 'Bucket was not recoverable from chain.', {
        remittanceId: remittance.id,
        bucketId: bucket.id
      }, error);
      // Bucket not found on-chain — leave its current status
    }
  }

  if (!anyFound) {
    logError('soroban.recover', 'No vault data found on-chain for remittance.', undefined, {
      remittanceId: remittance.id,
      bucketCount: remittance.buckets.length
    });
    throw new Error('No vault data found on-chain for this remittance. The vault may not have been created.');
  }

  return {
    ...recovered,
    status: 'completed',
    vaultContractId: VAULT_CONTRACT_ID,
    vaultTransactionHash: recovered.vaultTransactionHash,
    vaultExpertUrl: recovered.vaultExpertUrl
  };
};

const submitVaultCall = async (
  sourcePublicKey: string,
  method: string,
  args: xdr.ScVal[],
  onProgress?: (update: VaultProgressUpdate) => void
) => {
  try {
    const server = new rpc.Server(SOROBAN_RPC_URL);
    logInfo('soroban.submit', 'Building Soroban transaction.', {
      method,
      sourcePublicKey,
      argsCount: args.length,
      rpcUrl: SOROBAN_RPC_URL,
      vaultContractId: VAULT_CONTRACT_ID
    });
    onProgress?.({ phase: 'preparing', message: 'Simulating the Soroban transaction.' });
    const tx = await buildVaultTransaction(sourcePublicKey, method, args);
    logDebug('soroban.submit', 'Built Soroban transaction.', {
      method,
      transactionDetails: describeFreighterTransactionXdr(tx.toXDR()),
      xdrLength: tx.toXDR().length
    });

    const prepared = await server.prepareTransaction(tx);
    const preparedXdr = prepared.toXDR();
    logInfo('soroban.submit', 'Prepared Soroban transaction from RPC simulation.', {
      method,
      fee: prepared.fee,
      sequence: prepared.sequence,
      transactionDetails: describeFreighterTransactionXdr(preparedXdr),
      xdrLength: preparedXdr.length,
      xdrPrefix: preparedXdr.slice(0, 48)
    });

    onProgress?.({ phase: 'signing', message: 'Waiting for Freighter signature.' });
    const signedXdr = await signFreighterTransaction(preparedXdr, sourcePublicKey);
    const signedTransaction = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const sendResult = await server.sendTransaction(signedTransaction);
    logInfo('soroban.submit', 'Soroban transaction sent to RPC.', {
      method,
      status: sendResult.status,
      hash: sendResult.hash,
      errorResultXdr: 'errorResultXdr' in sendResult ? sendResult.errorResultXdr : undefined
    });

    if (sendResult.status === 'ERROR') {
      logError('soroban.submit', 'Soroban RPC rejected transaction.', undefined, {
        method,
        hash: sendResult.hash,
        errorResultXdr: 'errorResultXdr' in sendResult ? sendResult.errorResultXdr : undefined
      });
      throw new Error('Soroban RPC rejected the transaction.');
    }

    onProgress?.({
      phase: 'submitted',
      message: `Transaction submitted. Waiting for ${NETWORK_PILL_LABEL} confirmation.`,
      hash: sendResult.hash
    });

    return waitForSorobanTransaction(server, sendResult.hash, onProgress);
  } catch (error) {
    logError('soroban.submit', 'Soroban vault call failed.', error, { method, sourcePublicKey });
    throw new Error(formatVaultError(error));
  }
};

const waitForSorobanTransaction = async (
  server: rpc.Server,
  txHash: string,
  onProgress?: (update: VaultProgressUpdate) => void
) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    onProgress?.({
      phase: 'confirming',
      message: `Confirming on-chain. Check ${attempt + 1}/60.`,
      hash: txHash
    });
    const result = await server.getTransaction(txHash);
    logDebug('soroban.confirm', 'Polled Soroban transaction status.', {
      txHash,
      attempt: attempt + 1,
      status: result.status
    });

    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      logInfo('soroban.confirm', 'Soroban transaction confirmed.', { txHash, attempt: attempt + 1 });
      return { hash: txHash };
    }

    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      logError('soroban.confirm', 'Soroban transaction failed on-chain.', undefined, { txHash, attempt: attempt + 1 });
      throw new Error('Soroban transaction failed on-chain.');
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  logError('soroban.confirm', 'Timed out waiting for Soroban transaction confirmation.', undefined, { txHash });
  throw new Error(`Timed out waiting for Soroban transaction confirmation. The transaction may still confirm on ${NETWORK_PILL_LABEL}; check the Stellar Expert link if a hash is shown.`);
};

const buildVaultTransaction = async (sourcePublicKey: string | undefined, method: string, args: xdr.ScVal[]) => {
  if (!VAULT_CONTRACT_ID) {
    throw new Error('VITE_PADALASPLIT_VAULT_CONTRACT_ID is not configured.');
  }

  const server = new rpc.Server(SOROBAN_RPC_URL);
  const sourceAccount = sourcePublicKey
    ? await server.getAccount(sourcePublicKey)
    : new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
  const vault = new Contract(VAULT_CONTRACT_ID);

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE
  })
    .addOperation(vault.call(method, ...args))
    .setTimeout(60)
    .build();

  logDebug('soroban.build', 'Built vault contract call.', {
    method,
    sourcePublicKey: sourcePublicKey || 'readonly',
    sequence: sourceAccount.sequenceNumber()
  });

  return transaction;
};

const bucketSpecsToScVal = (buckets: VaultBucketSpec[]) =>
  xdr.ScVal.scvVec(
    buckets.map((bucket) =>
      xdr.ScVal.scvMap([
        scMapEntry('amount', nativeToScVal(xlmToStroops(bucket.amount), { type: 'i128' })),
        scMapEntry('bucket_id', bytes32ScVal(bucket.bucketId)),
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

const vaultErrorMessages: Record<string, string> = {
  '1': 'Vault is already initialized.',
  '2': 'Vault is not initialized.',
  '3': 'Add at least one bucket before creating a vault remittance.',
  '4': 'Every vault bucket amount must be greater than 0.',
  '5': 'Two buckets resolved to the same contract bucket ID.',
  '6': 'This remittance already exists in the Soroban vault. Create a new preview to submit another vault, or use the existing recipient dashboard entry.',
  '7': 'Vault bucket was not found.',
  '8': 'Only the recipient wallet can withdraw this bucket.',
  '9': 'This bucket is still locked. Wait until its unlock time before withdrawing.',
  '10': 'This bucket was already withdrawn.'
};

export const REMITTANCE_EXISTS_MESSAGE = vaultErrorMessages['6'];

const formatVaultError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const contractError = message.match(/Error\(Contract,\s*#(\d+)\)/);
  if (contractError?.[1] && vaultErrorMessages[contractError[1]]) {
    return vaultErrorMessages[contractError[1]];
  }

  return message;
};
