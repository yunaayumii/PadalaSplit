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

export const DEFAULT_DEMO_RECIPIENT_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

export const getDemoRecipientAddress = () =>
  import.meta.env.VITE_DEMO_RECIPIENT_ADDRESS?.trim() || DEFAULT_DEMO_RECIPIENT_ADDRESS;

export const createDefaultUnlockAt = (minutesFromNow = 3) => {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
};

export const createDemoForm = (): RemittanceFormState => ({
  senderName: 'Maria Santos',
  recipientName: 'Ana Santos',
  recipientAddress: getDemoRecipientAddress(),
  totalAmount: 100,
  splitMode: 'percentage',
  buckets: DEFAULT_BUCKETS.map((bucket) => ({
    ...bucket,
    unlockAt: bucket.locked ? createDefaultUnlockAt() : undefined
  }))
});

export const createSessionId = () => {
  return (
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}`
  );
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
    if (bucket.locked && !bucket.unlockAt) {
      errors.push(`${bucket.label || `Bucket ${index + 1}`} needs an unlock date.`);
    }
    if (bucket.locked && bucket.unlockAt && Number.isNaN(Date.parse(bucket.unlockAt))) {
      errors.push(`${bucket.label || `Bucket ${index + 1}`} needs a valid unlock date.`);
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
      unlockTimestamp: bucket.locked && bucket.unlockAt
        ? Math.floor(new Date(bucket.unlockAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      paymentStatus: 'pending'
    }))
  };
};

export const getRemittanceTotals = (remittance: RemittanceRecord) => {
  const paidTotal = remittance.buckets
    .filter(
      (bucket) =>
        bucket.paymentStatus === 'paid' ||
        bucket.paymentStatus === 'demo' ||
        bucket.paymentStatus === 'vaulted' ||
        bucket.paymentStatus === 'withdrawable' ||
        bucket.paymentStatus === 'withdrawn'
    )
    .reduce((sum, bucket) => sum + bucket.amount, 0);
  const lockedTotal = remittance.buckets.filter((bucket) => bucket.locked).reduce((sum, bucket) => sum + bucket.amount, 0);
  const vaultedTotal = remittance.buckets
    .filter((bucket) => bucket.paymentStatus === 'vaulted')
    .reduce((sum, bucket) => sum + bucket.amount, 0);
  const withdrawableTotal = remittance.buckets
    .filter((bucket) => bucket.paymentStatus === 'withdrawable')
    .reduce((sum, bucket) => sum + bucket.amount, 0);
  const withdrawnTotal = remittance.buckets
    .filter((bucket) => bucket.paymentStatus === 'withdrawn')
    .reduce((sum, bucket) => sum + bucket.amount, 0);

  return {
    paidTotal: roundXlm(paidTotal),
    lockedTotal: roundXlm(lockedTotal),
    availableTotal: roundXlm(remittance.totalAmount - lockedTotal),
    vaultedTotal: roundXlm(vaultedTotal),
    withdrawableTotal: roundXlm(withdrawableTotal),
    withdrawnTotal: roundXlm(withdrawnTotal)
  };
};

export const canSubmitDirectPayments = (remittance: RemittanceRecord, isVaultConfigured: boolean) =>
  isVaultConfigured || !remittance.buckets.some((bucket) => bucket.locked);
