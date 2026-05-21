import { describe, expect, it } from 'vitest';
import {
  calculateBuckets,
  createDemoForm,
  createRemittanceRecord,
  getRemittanceTotals,
  memoForBucket,
  validateRemittance
} from '../src/lib/split';

describe('split calculations', () => {
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
});
