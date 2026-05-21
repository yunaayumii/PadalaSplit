import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Database,
  ExternalLink,
  Loader2,
  LockKeyhole,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Unlock
} from 'lucide-react';
import {
  calculateBuckets,
  createDemoForm,
  createRemittanceRecord,
  createSessionId,
  formatXlm,
  getRemittanceTotals,
  memoForBucket,
  validateRemittance
} from './lib/split';
import { connectFreighter, getStellarExpertUrl, submitBucketPayment } from './lib/stellar';
import { isSupabaseConfigured, listRemittances, saveRemittance } from './lib/storage';
import type { BucketDraft, RemittanceFormState, RemittanceRecord, SplitMode } from './lib/types';

const emptyBucket = (): BucketDraft => ({
  id:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `bucket-${Date.now()}`,
  label: '',
  percentage: 0,
  amount: 0,
  locked: false,
  releaseNote: 'Available immediately'
});

const demoHash = (bucketId: string) => `demo-${bucketId}-${Date.now().toString(16)}`;

function App() {
  const [sessionId, setSessionId] = useState('');
  const [form, setForm] = useState<RemittanceFormState>(() => createDemoForm());
  const [senderPublicKey, setSenderPublicKey] = useState('');
  const [activeRemittance, setActiveRemittance] = useState<RemittanceRecord | null>(null);
  const [history, setHistory] = useState<RemittanceRecord[]>([]);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const nextSessionId = createSessionId();
    setSessionId(nextSessionId);
    listRemittances(nextSessionId)
      .then((records) => {
        setHistory(records);
        if (records[0]) setActiveRemittance(records[0]);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load remittance history.'));
  }, []);

  const calculatedBuckets = useMemo(
    () => calculateBuckets(form.buckets, form.totalAmount, form.splitMode),
    [form.buckets, form.totalAmount, form.splitMode]
  );
  const validation = useMemo(
    () => validateRemittance({ ...form, buckets: calculatedBuckets }),
    [form, calculatedBuckets]
  );
  const totalAllocated = calculatedBuckets.reduce((sum, bucket) => sum + bucket.amount, 0);

  const updateForm = (patch: Partial<RemittanceFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const updateBucket = (id: string, patch: Partial<BucketDraft>) => {
    setForm((current) => ({
      ...current,
      buckets: current.buckets.map((bucket) => (bucket.id === id ? { ...bucket, ...patch } : bucket))
    }));
  };

  const switchSplitMode = (splitMode: SplitMode) => {
    setForm((current) => ({
      ...current,
      splitMode,
      buckets: calculateBuckets(current.buckets, current.totalAmount, current.splitMode)
    }));
  };

  const persistAndSelect = async (remittance: RemittanceRecord) => {
    const saved = await saveRemittance(remittance);
    setActiveRemittance(saved);
    setHistory((records) => [saved, ...records.filter((record) => record.id !== saved.id)]);
    return saved;
  };

  const handleCreateRemittance = async () => {
    const nextForm = { ...form, buckets: calculatedBuckets };
    const nextValidation = validateRemittance(nextForm);
    if (!nextValidation.isValid) {
      setMessage(nextValidation.errors[0]);
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      const remittance = createRemittanceRecord(nextForm, sessionId, senderPublicKey || undefined);
      await persistAndSelect(remittance);
      setMessage('Remittance preview saved. Submit Testnet payments or run demo proof.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save remittance.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectFreighter = async () => {
    setMessage('');
    try {
      const publicKey = await connectFreighter();
      setSenderPublicKey(publicKey);
      setMessage('Freighter connected on Stellar Testnet.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to connect Freighter.');
    }
  };

  const handleDemoProof = async () => {
    if (!activeRemittance) return;

    const updated: RemittanceRecord = {
      ...activeRemittance,
      status: 'demo',
      buckets: activeRemittance.buckets.map((bucket) => {
        const hash = demoHash(bucket.id);
        return {
          ...bucket,
          paymentStatus: 'demo',
          transactionHash: hash,
          stellarExpertUrl: getStellarExpertUrl(hash)
        };
      })
    };

    await persistAndSelect(updated);
    setMessage('Demo proof generated. Use real Testnet payments for judge-verifiable hashes.');
  };

  const handleSubmitPayments = async () => {
    if (!activeRemittance) return;
    if (!senderPublicKey) {
      setMessage('Connect Freighter before submitting Testnet payments.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    let working: RemittanceRecord = { ...activeRemittance, status: 'submitting' };
    await persistAndSelect(working);

    for (const bucket of working.buckets) {
      working = {
        ...working,
        buckets: working.buckets.map((candidate) =>
          candidate.id === bucket.id ? { ...candidate, paymentStatus: 'submitting', error: undefined } : candidate
        )
      };
      await persistAndSelect(working);

      try {
        const result = await submitBucketPayment({
          sourcePublicKey: senderPublicKey,
          destination: working.recipientAddress,
          amount: bucket.amount,
          memo: bucket.memo
        });
        working = {
          ...working,
          buckets: working.buckets.map((candidate) =>
            candidate.id === bucket.id
              ? {
                  ...candidate,
                  paymentStatus: 'paid',
                  transactionHash: result.hash,
                  stellarExpertUrl: result.stellarExpertUrl
                }
              : candidate
          )
        };
      } catch (error) {
        working = {
          ...working,
          status: 'partial',
          buckets: working.buckets.map((candidate) =>
            candidate.id === bucket.id
              ? {
                  ...candidate,
                  paymentStatus: 'failed',
                  error: error instanceof Error ? error.message : 'Payment failed.'
                }
              : candidate
          )
        };
        await persistAndSelect(working);
        setMessage(`Payment failed for ${bucket.label}. Fix the issue and retry.`);
        setIsSubmitting(false);
        return;
      }
    }

    working = { ...working, status: 'completed' };
    await persistAndSelect(working);
    setMessage('All bucket payments submitted on Stellar Testnet.');
    setIsSubmitting(false);
  };

  const currentTotals = activeRemittance ? getRemittanceTotals(activeRemittance) : null;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <img src="/padalasplit-mark.svg" alt="" className="brand-mark" />
          <h1>PadalaSplit</h1>
          <p>Purpose-based Stellar remittances for OFWs and Filipino families.</p>
        </div>
        <div className="hero-actions">
          <span className="network-pill">Stellar Testnet</span>
          <button type="button" className="secondary-button" onClick={() => setForm(createDemoForm())}>
            Load Demo
          </button>
        </div>
      </section>

      <section className="status-row">
        <div className="status-item">
          <Database size={18} />
          <span>{isSupabaseConfigured() ? 'Supabase connected' : 'Local fallback storage'}</span>
        </div>
        <div className="status-item">
          <ShieldCheck size={18} />
          <span>{senderPublicKey ? `Freighter ${senderPublicKey.slice(0, 6)}...${senderPublicKey.slice(-4)}` : 'Freighter not connected'}</span>
        </div>
        <button type="button" className="primary-button compact" onClick={handleConnectFreighter}>
          Connect Freighter
        </button>
      </section>

      {message && <div className="toast">{message}</div>}

      <div className="workspace">
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Sender Flow</p>
              <h2>Create Remittance</h2>
            </div>
            <CircleDollarSign size={28} />
          </div>

          <div className="form-grid">
            <label>
              Sender name
              <input
                value={form.senderName}
                onChange={(event) => updateForm({ senderName: event.target.value })}
                placeholder="Maria Santos"
              />
            </label>
            <label>
              Recipient name
              <input
                value={form.recipientName}
                onChange={(event) => updateForm({ recipientName: event.target.value })}
                placeholder="Ana Santos"
              />
            </label>
            <label className="wide">
              Recipient Stellar wallet
              <input
                value={form.recipientAddress}
                onChange={(event) => updateForm({ recipientAddress: event.target.value })}
                placeholder="G..."
              />
            </label>
            <label>
              Total amount
              <input
                type="number"
                min="0"
                step="0.0000001"
                value={form.totalAmount}
                onChange={(event) => updateForm({ totalAmount: Number(event.target.value) })}
              />
            </label>
            <label>
              Split mode
              <select value={form.splitMode} onChange={(event) => switchSplitMode(event.target.value as SplitMode)}>
                <option value="percentage">Percentage</option>
                <option value="amount">Amount</option>
              </select>
            </label>
          </div>

          <div className="bucket-list">
            <div className="bucket-header">
              <h3>Buckets</h3>
              <button
                type="button"
                className="icon-button"
                aria-label="Add bucket"
                onClick={() => updateForm({ buckets: [...form.buckets, emptyBucket()] })}
              >
                <Plus size={18} />
              </button>
            </div>

            {calculatedBuckets.map((bucket) => (
              <div className="bucket-editor" key={bucket.id}>
                <input
                  aria-label="Bucket label"
                  value={bucket.label}
                  onChange={(event) => updateBucket(bucket.id, { label: event.target.value })}
                  placeholder="Bucket"
                />
                <input
                  aria-label={form.splitMode === 'percentage' ? 'Bucket percentage' : 'Bucket amount'}
                  type="number"
                  min="0"
                  step="0.0000001"
                  value={form.splitMode === 'percentage' ? bucket.percentage : bucket.amount}
                  onChange={(event) =>
                    updateBucket(
                      bucket.id,
                      form.splitMode === 'percentage'
                        ? { percentage: Number(event.target.value) }
                        : { amount: Number(event.target.value) }
                    )
                  }
                />
                <div className="computed">{formatXlm(bucket.amount)} XLM</div>
                <button
                  type="button"
                  className={`lock-button ${bucket.locked ? 'is-locked' : ''}`}
                  onClick={() => updateBucket(bucket.id, { locked: !bucket.locked })}
                >
                  {bucket.locked ? <LockKeyhole size={16} /> : <Unlock size={16} />}
                  {bucket.locked ? 'Locked' : 'Open'}
                </button>
                <input
                  aria-label="Release note"
                  value={bucket.releaseNote}
                  onChange={(event) => updateBucket(bucket.id, { releaseNote: event.target.value })}
                  placeholder="Release note"
                />
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label="Remove bucket"
                  onClick={() => updateForm({ buckets: form.buckets.filter((candidate) => candidate.id !== bucket.id) })}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          <div className="validation-box">
            <div>
              <strong>{formatXlm(totalAllocated)} / {formatXlm(form.totalAmount)} XLM allocated</strong>
              <span>{validation.isValid ? 'Ready for confirmation' : validation.errors[0]}</span>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={!validation.isValid || isSaving}
              onClick={handleCreateRemittance}
            >
              {isSaving ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
              Preview
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Payment Proof</p>
              <h2>Submit Split Payments</h2>
            </div>
            <Send size={28} />
          </div>

          {activeRemittance ? (
            <>
              <div className="summary-grid">
                <div>
                  <span>Total</span>
                  <strong>{formatXlm(activeRemittance.totalAmount)} XLM</strong>
                </div>
                <div>
                  <span>Available</span>
                  <strong>{formatXlm(currentTotals?.availableTotal || 0)} XLM</strong>
                </div>
                <div>
                  <span>Protected</span>
                  <strong>{formatXlm(currentTotals?.lockedTotal || 0)} XLM</strong>
                </div>
              </div>

              <div className="proof-list">
                {activeRemittance.buckets.map((bucket) => (
                  <article className="proof-item" key={bucket.id}>
                    <div>
                      <strong>{bucket.label}</strong>
                      <span>Memo: {bucket.memo || memoForBucket(bucket.label)}</span>
                    </div>
                    <div>
                      <strong>{formatXlm(bucket.amount)} XLM</strong>
                      <span>{bucket.locked ? bucket.releaseNote : 'Available immediately'}</span>
                    </div>
                    <span className={`payment-chip ${bucket.paymentStatus}`}>{bucket.paymentStatus}</span>
                    {bucket.stellarExpertUrl ? (
                      <a className="icon-link" href={bucket.stellarExpertUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={16} />
                        Stellar Expert
                      </a>
                    ) : (
                      <span className="muted">No proof yet</span>
                    )}
                    {bucket.error && <p className="error-text">{bucket.error}</p>}
                  </article>
                ))}
              </div>

              <div className="action-row">
                <button type="button" className="secondary-button" onClick={handleDemoProof}>
                  <Copy size={18} />
                  Demo Proof
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={isSubmitting}
                  onClick={handleSubmitPayments}
                >
                  {isSubmitting ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                  Submit Testnet
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <CheckCircle2 size={32} />
              <p>Create a remittance preview to see payment proof and recipient dashboard data.</p>
            </div>
          )}
        </section>
      </div>

      <section className="panel dashboard-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Recipient Dashboard</p>
            <h2>Family Budget View</h2>
          </div>
          <span className="network-pill">{history.length} saved</span>
        </div>

        {history.length > 0 ? (
          <div className="history-grid">
            {history.map((remittance) => (
              <button
                type="button"
                className={`history-card ${activeRemittance?.id === remittance.id ? 'active' : ''}`}
                key={remittance.id}
                onClick={() => setActiveRemittance(remittance)}
              >
                <span>{remittance.recipientName}</span>
                <strong>{formatXlm(remittance.totalAmount)} XLM</strong>
                <small>{new Date(remittance.createdAt).toLocaleString()}</small>
                <small>{remittance.buckets.length} buckets · {remittance.status}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No remittance history yet for this demo session.</p>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
