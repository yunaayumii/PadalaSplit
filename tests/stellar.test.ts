import {
  Account,
  Asset,
  BASE_FEE,
  Contract,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal
} from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { describeFreighterTransactionXdr } from '../src/lib/stellar';

const source = 'GA3E3MZTNAE4VT4Q3NVMZWGTG67DRTUQBVZWLH3TLRWI3ISU37QJLFAA';
const vaultContractId = 'CBZ5PWU5NYF4BNHYXEAJD3CU6WPBK7TZ225V6XZMBKQMPWOH44K7QN7L';

const buildSourceAccount = () => new Account(source, '1');

describe('Freighter transaction diagnostics', () => {
  it('describes classic transaction envelopes before signing', () => {
    const tx = new TransactionBuilder(buildSourceAccount(), {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(
        Operation.payment({
          destination: source,
          asset: Asset.native(),
          amount: '1'
        })
      )
      .setTimeout(60)
      .build();

    expect(describeFreighterTransactionXdr(tx.toXDR())).toEqual({
      envelopeType: 'envelopeTypeTx',
      operationTypes: ['payment'],
      sorobanAuthTypes: []
    });
  });

  it('describes Soroban invoke transactions before signing', () => {
    const vault = new Contract(vaultContractId);
    const tx = new TransactionBuilder(buildSourceAccount(), {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(vault.call('get_bucket', nativeToScVal('debug', { type: 'symbol' })))
      .setTimeout(60)
      .build();

    expect(describeFreighterTransactionXdr(tx.toXDR())).toMatchObject({
      envelopeType: 'envelopeTypeTx',
      operationTypes: ['invokeHostFunction'],
      sorobanAuthTypes: []
    });
  });

  it('reports unreadable XDR without calling Freighter', () => {
    const details = describeFreighterTransactionXdr('not-xdr');

    expect(details.envelopeType).toBe('unreadable');
    expect(details.localError).toBeTruthy();
  });
});
