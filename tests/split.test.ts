import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  calculateBuckets,
  canSubmitDirectPayments,
  createDemoForm,
  createRemittanceRecord,
  getRemittanceTotals,
  memoForBucket,
  validateRemittance
} from '../src/lib/split';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('split calculations', () => {
  it('uses the configured demo recipient address when provided', () => {
    vi.stubEnv('VITE_DEMO_RECIPIENT_ADDRESS', 'GDEMORECIPIENT00000000000000000000000000000000000000000000');

    expect(createDemoForm().recipientAddress).toBe(
      'GDEMORECIPIENT00000000000000000000000000000000000000000000'
    );
  });

  it('calculates bucket amounts from percentages', () => {
    const form = createDemoForm();
    const buckets = calculateBuckets(form.buckets, 100, 'percentage');

    expect(buckets.map((bucket) => bucket.amount)).toEqual([40, 30, 20, 10]);
  });

  it('calculates percentages from fixed amounts', () => {
    const form = createDemoForm();
    const buckets = calculateBuckets(form.buckets, 200, 'amount');

    expect(buckets.map((bucket) => bucket.percentage)).toEqual([20, 15, 10, 5]);
  });

  it('rejects splits that do not equal the remittance amount', () => {
    const form = createDemoForm();
    form.buckets[0].percentage = 35;

    const result = validateRemittance(form);

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('100%');
  });

  it('rejects locked buckets with missing or invalid unlock dates', () => {
    const missingDateForm = createDemoForm();
    missingDateForm.buckets[1].unlockAt = undefined;

    const invalidDateForm = createDemoForm();
    invalidDateForm.buckets[1].unlockAt = 'not-a-date';

    expect(validateRemittance(missingDateForm).errors.join(' ')).toContain('needs an unlock date');
    expect(validateRemittance(invalidDateForm).errors.join(' ')).toContain('needs a valid unlock date');
  });

  it('builds safe 28-character memo labels', () => {
    expect(memoForBucket('Emergency Savings Fund For June')).toHaveLength(28);
    expect(memoForBucket('  Groceries  Budget ')).toBe('groceries-budget');
  });

  it('creates records with locked bucket statuses', () => {
    const form = createDemoForm();
    const record = createRemittanceRecord(form, 'session-1', 'GABC');
    const totals = getRemittanceTotals(record);

    expect(record.buckets.find((bucket) => bucket.label === 'Groceries')?.status).toBe('available');
    expect(record.buckets.find((bucket) => bucket.label === 'Tuition')?.status).toBe('locked');
    expect(totals.lockedTotal).toBe(60);
  });

  it('blocks direct payments for locked buckets unless the vault is configured', () => {
    const record = createRemittanceRecord(createDemoForm(), 'session-1', 'GABC');

    expect(canSubmitDirectPayments(record, false)).toBe(false);
    expect(canSubmitDirectPayments(record, true)).toBe(true);
  });

  it('distinguishes vaulted, withdrawable, and withdrawn totals', () => {
    const record = createRemittanceRecord(createDemoForm(), 'session-1', 'GABC');
    record.buckets[1].paymentStatus = 'vaulted';
    record.buckets[2].paymentStatus = 'withdrawable';
    record.buckets[3].paymentStatus = 'withdrawn';

    const totals = getRemittanceTotals(record);

    expect(totals.vaultedTotal).toBe(30);
    expect(totals.withdrawableTotal).toBe(20);
    expect(totals.withdrawnTotal).toBe(10);
    expect(totals.paidTotal).toBe(60);
  });
});
