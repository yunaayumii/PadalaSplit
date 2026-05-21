import type {
  BucketDraft,
  BucketRecord,
  RemittanceFormState,
  RemittanceRecord,
  SplitMode,
  ValidationResult
} from './types';

export const DEFAULT_BUCKETS: BucketDraft[] = [
  {
    id: 'groceries',
    label: 'Groceries',
    percentage: 40,
    amount: 40,
    locked: false,
    releaseNote: 'Available immediately'
  },
  {
    id: 'tuition',
    label: 'Tuition',
    percentage: 30,
    amount: 30,
    locked: true,
    releaseNote: 'Locked until enrollment week'
  },
  {
    id: 'bills',
    label: 'Bills',
    percentage: 20,
    amount: 20,
    locked: true,
    releaseNote: 'Protected for utility due dates'
  },
  {
    id: 'emergency',
    label: 'Emergency',
    percentage: 10,
    amount: 10,
    locked: true,
    releaseNote: 'Sender approval recommended'
  }
];

export const DEMO_RECIPIENT_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

export const createDemoForm = (): RemittanceFormState => ({
  senderName: 'Maria Santos',
  recipientName: 'Ana Santos',
  recipientAddress: DEMO_RECIPIENT_ADDRESS,
  totalAmount: 100,
  splitMode: 'percentage',
  buckets: DEFAULT_BUCKETS.map((bucket) => ({ ...bucket }))
});

export const createSessionId = () => {
  const existing = window.localStorage.getItem('padalasplit.sessionId');
  if (existing) {
    return existing;
  }

  const sessionId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}`;
  window.localStorage.setItem('padalasplit.sessionId', sessionId);
  return sessionId;
};

export const roundXlm = (value: number) => Math.round((value + Number.EPSILON) * 10_000_000) / 10_000_000;

export const formatXlm = (value: number) => roundXlm(value).toFixed(2);

export const memoForBucket = (label: string) => {
  const normalized = label.trim().replace(/\s+/g, '-').toLowerCase();
  return normalized.slice(0, 28) || 'bucket';
};

export const calculateBuckets = (
  buckets: BucketDraft[],
  totalAmount: number,
  splitMode: SplitMode
): BucketDraft[] => {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return buckets.map((bucket) => ({ ...bucket, amount: 0 }));
  }

  if (splitMode === 'percentage') {
    return buckets.map((bucket) => ({
      ...bucket,
      percentage: Number.isFinite(bucket.percentage) ? bucket.percentage : 0,
      amount: roundXlm((totalAmount * (Number.isFinite(bucket.percentage) ? bucket.percentage : 0)) / 100)
    }));
  }

  return buckets.map((bucket) => ({
    ...bucket,
    amount: Number.isFinite(bucket.amount) ? roundXlm(bucket.amount) : 0,
    percentage:
      totalAmount > 0 && Number.isFinite(bucket.amount) ? roundXlm((bucket.amount / totalAmount) * 100) : 0
  }));
};

export const validateRemittance = (form: RemittanceFormState): ValidationResult => {
  const errors: string[] = [];
  const buckets = calculateBuckets(form.buckets, form.totalAmount, form.splitMode);
  const bucketAmountTotal = roundXlm(buckets.reduce((sum, bucket) => sum + bucket.amount, 0));
  const percentageTotal = roundXlm(buckets.reduce((sum, bucket) => sum + bucket.percentage, 0));

  if (!form.senderName.trim()) errors.push('Sender name is required.');
  if (!form.recipientName.trim()) errors.push('Recipient name is required.');
  if (!form.recipientAddress.trim()) errors.push('Recipient Stellar address is required.');
  if (!form.recipientAddress.trim().startsWith('G')) errors.push('Recipient address should be a Stellar public key.');
  if (!Number.isFinite(form.totalAmount) || form.totalAmount <= 0) errors.push('Total amount must be greater than 0.');
  if (buckets.length === 0) errors.push('Add at least one bucket.');

  buckets.forEach((bucket, index) => {
    if (!bucket.label.trim()) errors.push(`Bucket ${index + 1} needs a label.`);
    if (!Number.isFinite(bucket.amount) || bucket.amount <= 0) {
      errors.push(`${bucket.label || `Bucket ${index + 1}`} must have an amount greater than 0.`);
    }
  });

  if (form.splitMode === 'percentage' && Math.abs(percentageTotal - 100) > 0.000001) {
    errors.push(`Bucket percentages must total 100%. Current total is ${percentageTotal.toFixed(2)}%.`);
  }

  if (Math.abs(bucketAmountTotal - form.totalAmount) > 0.000001) {
    errors.push(
      `Bucket amounts must equal the full remittance. Current total is ${formatXlm(bucketAmountTotal)} XLM.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const createRemittanceRecord = (
  form: RemittanceFormState,
  sessionId: string,
  senderPublicKey?: string
): RemittanceRecord => {
  const calculatedBuckets = calculateBuckets(form.buckets, form.totalAmount, form.splitMode);

  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `remittance-${Date.now()}`,
    sessionId,
    senderName: form.senderName.trim(),
    senderPublicKey,
    recipientName: form.recipientName.trim(),
    recipientAddress: form.recipientAddress.trim(),
    totalAmount: roundXlm(form.totalAmount),
    status: 'ready',
    createdAt: new Date().toISOString(),
    buckets: calculatedBuckets.map<BucketRecord>((bucket) => ({
      ...bucket,
      label: bucket.label.trim(),
      memo: memoForBucket(bucket.label),
      status: bucket.locked ? 'locked' : 'available',
      paymentStatus: 'pending'
    }))
  };
};

export const getRemittanceTotals = (remittance: RemittanceRecord) => {
  const paidTotal = remittance.buckets
    .filter((bucket) => bucket.paymentStatus === 'paid' || bucket.paymentStatus === 'demo')
    .reduce((sum, bucket) => sum + bucket.amount, 0);
  const lockedTotal = remittance.buckets.filter((bucket) => bucket.locked).reduce((sum, bucket) => sum + bucket.amount, 0);

  return {
    paidTotal: roundXlm(paidTotal),
    lockedTotal: roundXlm(lockedTotal),
    availableTotal: roundXlm(remittance.totalAmount - lockedTotal)
  };
};
