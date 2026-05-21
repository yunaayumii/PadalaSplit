export type BucketStatus = 'available' | 'locked';
export type PaymentStatus =
  | 'pending'
  | 'submitting'
  | 'paid'
  | 'failed'
  | 'demo'
  | 'vaulted'
  | 'withdrawable'
  | 'withdrawn';
export type SplitMode = 'percentage' | 'amount';

export type BucketDraft = {
  id: string;
  label: string;
  percentage: number;
  amount: number;
  locked: boolean;
  releaseNote: string;
  unlockAt?: string;
};

export type BucketRecord = BucketDraft & {
  memo: string;
  status: BucketStatus;
  paymentStatus: PaymentStatus;
  contractBucketId?: string;
  unlockTimestamp?: number;
  transactionHash?: string;
  stellarExpertUrl?: string;
  withdrawalHash?: string;
  withdrawalExpertUrl?: string;
  error?: string;
};

export type RemittanceRecord = {
  id: string;
  sessionId: string;
  senderName: string;
  senderPublicKey?: string;
  recipientName: string;
  recipientAddress: string;
  totalAmount: number;
  status: 'draft' | 'ready' | 'submitting' | 'partial' | 'completed' | 'demo';
  createdAt: string;
  vaultContractId?: string;
  vaultTransactionHash?: string;
  vaultExpertUrl?: string;
  buckets: BucketRecord[];
};

export type RemittanceFormState = {
  senderName: string;
  recipientName: string;
  recipientAddress: string;
  totalAmount: number;
  splitMode: SplitMode;
  buckets: BucketDraft[];
};

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
};
