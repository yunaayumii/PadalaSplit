import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bug,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Database,
  ExternalLink,
  Loader2,
  LockKeyhole,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  Unlock
} from 'lucide-react';
import {
  calculateBuckets,
  canSubmitDirectPayments,
  createDefaultUnlockAt,
  createDemoForm,
  createRemittanceRecord,
  createSessionId,
  formatXlm,
  getRemittanceTotals,
  memoForBucket,
  validateRemittance
} from './lib/split';
import {
  applyVaultMetadata,
  bucketToVaultSpec,
  createVaultRemittance,
  isSorobanVaultConfigured,
  recoverVaultRemittance,
  REMITTANCE_EXISTS_MESSAGE,
  type VaultProgressUpdate,
  withdrawVaultBucket
} from './lib/soroban';
import { connectFreighter, getStellarExpertUrl, submitBucketPayment, tryAutoConnect } from './lib/stellar';
import {
  clearLogEntries,
  getLogEntries,
  logDebug,
  logError,
  logInfo,
  logsToText,
  subscribeLogEntries,
  type LogEntry
} from './lib/logger';
import { clearLocalRemittances, clearRemittances, isSupabaseConfigured, listRemittances, listRemittancesForWallet, saveRemittance } from './lib/storage';
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
  releaseNote: 'Available immediately',
  unlockAt: undefined
});

const demoHash = (bucketId: string) => `demo-${bucketId}-${Date.now().toString(16)}`;
type AppView = 'sender' | 'recipient';
type AppScreen = 'landing' | 'app';
const WALLET_STORAGE_KEY = 'padalasplit.walletPublicKey';

const messageFromError = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

function App() {
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [sessionId, setSessionId] = useState('');
  const [form, setForm] = useState<RemittanceFormState>(() => createDemoForm(window.localStorage.getItem(WALLET_STORAGE_KEY) || undefined));
  const [senderPublicKey, setSenderPublicKey] = useState('');
  const [activeRemittance, setActiveRemittance] = useState<RemittanceRecord | null>(null);
  const [history, setHistory] = useState<RemittanceRecord[]>([]);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawingBucketId, setWithdrawingBucketId] = useState('');
  const [activeView, setActiveView] = useState<AppView>('sender');
  const [vaultProgress, setVaultProgress] = useState<VaultProgressUpdate | null>(null);
  const [debugLogs, setDebugLogs] = useState<LogEntry[]>(() => getLogEntries());
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  const loadHistoryForWallet = async (publicKey: string) => {
    logInfo('app.history', 'Loading remittance history for wallet.', { publicKey });
    const records = await listRemittancesForWallet(publicKey);
    const normalized = records.map(normalizeInterruptedSubmission);
    logInfo('app.history', 'Loaded wallet remittance history.', { publicKey, count: normalized.length });
    setHistory(normalized);
    if (normalized[0]) setActiveRemittance(normalized[0]);
  };

  useEffect(() => subscribeLogEntries(setDebugLogs), []);

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      logError('browser.error', event.message || 'Unhandled browser error.', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError('browser.unhandledRejection', 'Unhandled promise rejection.', event.reason);
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const nextSessionId = createSessionId();
    setSessionId(nextSessionId);
    logInfo('app.init', 'Starting app session.', {
      sessionId: nextSessionId,
      vaultConfigured: isSorobanVaultConfigured(),
      supabaseConfigured: isSupabaseConfigured()
    });

    const init = async () => {
      // Try to silently reconnect Freighter (no popup)
      let publicKey = await tryAutoConnect();

      // Fall back to the wallet saved from a previous session
      if (!publicKey) {
        publicKey = window.localStorage.getItem(WALLET_STORAGE_KEY);
      }

      if (publicKey) {
        setSenderPublicKey(publicKey);
        window.localStorage.setItem(WALLET_STORAGE_KEY, publicKey);
        await loadHistoryForWallet(publicKey);
      } else {
        // First-time visitor with no wallet — load by session (empty)
        logInfo('app.history', 'Loading remittance history for session.', { sessionId: nextSessionId });
        const records = await listRemittances(nextSessionId);
        const normalized = records.map(normalizeInterruptedSubmission);
        logInfo('app.history', 'Loaded session remittance history.', { sessionId: nextSessionId, count: normalized.length });
        setHistory(normalized);
        if (normalized[0]) setActiveRemittance(normalized[0]);
      }
    };

    init().catch((error) => {
      logError('app.init', 'Unable to initialize app history.', error);
      setMessage(messageFromError(error, 'Unable to load remittance history.'));
    });
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
    logDebug('app.persist', 'Saving remittance record.', {
      remittanceId: remittance.id,
      status: remittance.status,
      bucketCount: remittance.buckets.length
    });
    const saved = await saveRemittance(remittance);
    setActiveRemittance(saved);
    setHistory((records) => [saved, ...records.filter((record) => record.id !== saved.id)]);
    logDebug('app.persist', 'Saved remittance record.', {
      remittanceId: saved.id,
      status: saved.status
    });
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
      logInfo('app.createPreview', 'Creating remittance preview.', {
        sessionId,
        senderPublicKey,
        recipientAddress: nextForm.recipientAddress,
        totalAmount: nextForm.totalAmount,
        bucketCount: nextForm.buckets.length
      });
      const remittance = createRemittanceRecord(nextForm, sessionId, senderPublicKey || undefined);
      await persistAndSelect(remittance);
      setMessage(
        isSorobanVaultConfigured()
          ? 'Remittance preview saved. Create the Soroban vault or run demo proof.'
          : 'Remittance preview saved. Configure the vault for locked buckets, or use direct Testnet payments for unlocked buckets.'
      );
    } catch (error) {
      logError('app.createPreview', 'Unable to save remittance preview.', error);
      setMessage(messageFromError(error, 'Unable to save remittance.'));
    } finally {
      setIsSaving(false);
    }
  };

  const enterApp = (view: AppView = 'sender') => {
    setActiveView(view);
    setScreen('app');
  };

  const handleClearHistory = async () => {
    try {
      logInfo('app.reset', 'Clearing demo history.', { count: history.length });
      await clearRemittances(history.map((record) => record.id));
      clearLocalRemittances();
      setHistory([]);
      setActiveRemittance(null);
      setVaultProgress(null);
      setMessage('Demo reset complete. Local/app history was cleared; any on-chain vault funds remain on Soroban Testnet.');
    } catch (error) {
      logError('app.reset', 'Unable to clear transaction history.', error);
      setMessage(messageFromError(error, 'Unable to clear transaction history.'));
    }
  };

  const handleConnectFreighter = async () => {
    setMessage('');
    try {
      const publicKey = await connectFreighter();
      setSenderPublicKey(publicKey);
      window.localStorage.setItem(WALLET_STORAGE_KEY, publicKey);
      setMessage('Freighter connected on Stellar Testnet.');
      // Reload history for the connected wallet
      await loadHistoryForWallet(publicKey);
    } catch (error) {
      logError('app.connectFreighter', 'Unable to connect Freighter.', error);
      setMessage(messageFromError(error, 'Unable to connect Freighter.'));
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
    logInfo('app.demoProof', 'Generated demo proof.', { remittanceId: updated.id, bucketCount: updated.buckets.length });
    setMessage('Demo proof generated. Use real Testnet payments for judge-verifiable hashes.');
  };

  const handleSubmitPayments = async () => {
    if (!activeRemittance) return;
    if (!senderPublicKey) {
      setMessage('Connect Freighter before submitting Testnet payments.');
      return;
    }
    if (activeRemittance.buckets.some((bucket) => bucket.locked)) {
      setMessage('Locked buckets cannot be sent with direct payments. Configure the Soroban vault or unlock every bucket first.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    let working: RemittanceRecord = { ...activeRemittance, senderPublicKey, status: 'submitting' };
    logInfo('app.directPayments', 'Starting direct bucket payments.', {
      remittanceId: working.id,
      bucketCount: working.buckets.length,
      senderPublicKey,
      recipientAddress: working.recipientAddress
    });
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
        logInfo('app.directPayments', 'Submitting bucket payment.', {
          remittanceId: working.id,
          bucketId: bucket.id,
          label: bucket.label,
          amount: bucket.amount
        });
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
        logInfo('app.directPayments', 'Bucket payment succeeded.', {
          remittanceId: working.id,
          bucketId: bucket.id,
          hash: result.hash
        });
      } catch (error) {
        logError('app.directPayments', 'Bucket payment failed.', error, {
          remittanceId: working.id,
          bucketId: bucket.id,
          label: bucket.label,
          amount: bucket.amount
        });
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
    logInfo('app.directPayments', 'All direct bucket payments completed.', { remittanceId: working.id });
    setMessage('All bucket payments submitted on Stellar Testnet.');
    setIsSubmitting(false);
  };

  const handleCreateVaultRemittance = async () => {
    if (!activeRemittance) return;
    if (!isSorobanVaultConfigured()) {
      setMessage('Configure VITE_PADALASPLIT_VAULT_CONTRACT_ID before creating a vault remittance.');
      return;
    }
    if (!senderPublicKey) {
      setMessage('Connect Freighter before creating a vault remittance.');
      return;
    }

    setIsSubmitting(true);
    const initialProgress: VaultProgressUpdate = {
      phase: 'preparing',
      message: 'Preparing Soroban vault transaction.'
    };
    setVaultProgress(initialProgress);
    setMessage(initialProgress.message);
    logInfo('app.vault', 'Starting Soroban vault remittance.', {
      remittanceId: activeRemittance.id,
      senderPublicKey,
      recipientAddress: activeRemittance.recipientAddress,
      bucketCount: activeRemittance.buckets.length
    });
    let working: RemittanceRecord = {
      ...activeRemittance,
      senderPublicKey,
      status: 'submitting',
      buckets: activeRemittance.buckets.map((bucket) => ({
        ...bucket,
        paymentStatus: 'submitting',
        error: undefined
      }))
    };
    await persistAndSelect(working);

    try {
      const result = await createVaultRemittance({
        sourcePublicKey: senderPublicKey,
        recipient: working.recipientAddress,
        remittanceId: working.id,
        buckets: working.buckets.map((bucket) => bucketToVaultSpec(working.id, bucket)),
        onProgress: (progress) => {
          logInfo('app.vault', 'Vault progress update.', {
            remittanceId: working.id,
            phase: progress.phase,
            hash: progress.hash
          });
          setVaultProgress(progress);
          setMessage(progress.message);
          // Eagerly persist vault metadata when the transaction is
          // submitted so the record survives page refreshes during
          // the on-chain confirmation phase.
          if (progress.phase === 'submitted' && progress.hash) {
            working = applyVaultMetadata(working, {
              hash: progress.hash,
              stellarExpertUrl: getStellarExpertUrl(progress.hash)
            });
            persistAndSelect(working).catch(() => {});
          }
        }
      });
      working = applyVaultMetadata(working, result);
      await persistAndSelect(working);
      setVaultProgress(null);
      logInfo('app.vault', 'Vault remittance completed.', { remittanceId: working.id, hash: result.hash });
      setMessage('Vault remittance created on Soroban Testnet. Recipient can withdraw each bucket after unlock.');
    } catch (error) {
      const errorMessage = messageFromError(error, 'Vault remittance failed.');
      logError('app.vault', 'Vault remittance failed.', error, {
        remittanceId: working.id,
        senderPublicKey,
        recipientAddress: working.recipientAddress
      });
      working =
        errorMessage === REMITTANCE_EXISTS_MESSAGE
          ? applyVaultMetadata(working)
          : {
              ...working,
              status: 'partial',
              buckets: working.buckets.map((bucket) => ({
                ...bucket,
                paymentStatus: 'failed',
                error: errorMessage
              }))
            };
      await persistAndSelect(working);
      setMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
      setVaultProgress(null);
    }
  };

  const handleWithdrawBucket = async (bucket: RemittanceRecord['buckets'][number]) => {
    if (!activeRemittance) return;
    if (!senderPublicKey) {
      setMessage('Connect the recipient Freighter wallet before withdrawing.');
      return;
    }
    if (senderPublicKey !== activeRemittance.recipientAddress) {
      setMessage('The connected Freighter wallet must match the remittance recipient address.');
      return;
    }

    setWithdrawingBucketId(bucket.id);
    setMessage('');
    try {
      logInfo('app.withdraw', 'Starting bucket withdrawal.', {
        remittanceId: activeRemittance.id,
        bucketId: bucket.id,
        senderPublicKey
      });
      const result = await withdrawVaultBucket({
        sourcePublicKey: senderPublicKey,
        remittanceId: activeRemittance.id,
        bucketId: bucket.id
      });
      const updated: RemittanceRecord = {
        ...activeRemittance,
        buckets: activeRemittance.buckets.map((candidate) =>
          candidate.id === bucket.id
            ? {
                ...candidate,
                paymentStatus: 'withdrawn',
                withdrawalHash: result.hash,
                withdrawalExpertUrl: result.stellarExpertUrl,
                error: undefined
              }
            : candidate
        )
      };
      await persistAndSelect(updated);
      logInfo('app.withdraw', 'Bucket withdrawal completed.', {
        remittanceId: activeRemittance.id,
        bucketId: bucket.id,
        hash: result.hash
      });
      setMessage(`${bucket.label} withdrawn from the Soroban vault.`);
    } catch (error) {
      logError('app.withdraw', 'Bucket withdrawal failed.', error, {
        remittanceId: activeRemittance.id,
        bucketId: bucket.id,
        senderPublicKey
      });
      const updated: RemittanceRecord = {
        ...activeRemittance,
        buckets: activeRemittance.buckets.map((candidate) =>
          candidate.id === bucket.id
            ? {
                ...candidate,
                error: error instanceof Error ? error.message : 'Withdrawal failed.'
              }
            : candidate
        )
      };
      await persistAndSelect(updated);
      setMessage(messageFromError(error, 'Unable to withdraw bucket.'));
    } finally {
      setWithdrawingBucketId('');
    }
  };

  const handleRecoverVault = async () => {
    const target = dashboardRemittance || activeRemittance;
    if (!target) {
      setMessage('Select a remittance to recover.');
      return;
    }
    if (!isSorobanVaultConfigured()) {
      setMessage('Soroban vault contract is not configured.');
      return;
    }

    setMessage('Checking Soroban vault for on-chain bucket data…');
    setIsSubmitting(true);
    try {
      logInfo('app.recover', 'Recovering vault data from chain.', {
        remittanceId: target.id,
        bucketCount: target.buckets.length
      });
      const recovered = await recoverVaultRemittance(target);
      await persistAndSelect(recovered);
      logInfo('app.recover', 'Vault data recovered from chain.', { remittanceId: target.id });
      setMessage('Vault recovered from on-chain data. You can now withdraw unlocked buckets.');
    } catch (error) {
      logError('app.recover', 'Unable to recover vault data.', error, { remittanceId: target.id });
      setMessage(messageFromError(error, 'Unable to recover vault data.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyDebugLogs = async () => {
    try {
      await navigator.clipboard.writeText(logsToText(debugLogs));
      logInfo('app.debugLogs', 'Copied debug logs.', { count: debugLogs.length });
      setMessage('Debug logs copied.');
    } catch (error) {
      logError('app.debugLogs', 'Unable to copy debug logs.', error, { count: debugLogs.length });
      setMessage('Unable to copy debug logs. Open the browser console for the same entries.');
    }
  };

  const handleClearDebugLogs = () => {
    clearLogEntries();
    setDebugLogs([]);
    setMessage('Debug logs cleared.');
  };

  const currentTotals = activeRemittance ? getRemittanceTotals(activeRemittance) : null;
  const activeIsVaultBacked = activeRemittance ? isVaultBacked(activeRemittance) : false;
  const activeIsComplete = activeRemittance?.status === 'completed' || activeRemittance?.status === 'demo';
  const vaultConfigured = isSorobanVaultConfigured();
  const proofAvailable = history.some(
    (remittance) =>
      Boolean(getVaultProofUrl(remittance)) ||
      remittance.buckets.some(
        (bucket) => bucket.paymentStatus !== 'demo' && Boolean(bucket.stellarExpertUrl || bucket.withdrawalExpertUrl)
      )
  );
  const directPaymentsBlocked = activeRemittance ? !canSubmitDirectPayments(activeRemittance, vaultConfigured) : false;
  const submitDisabled = isSubmitting || directPaymentsBlocked || activeIsComplete || activeIsVaultBacked;
  const submitButtonLabel = activeIsVaultBacked
    ? 'Vault Created'
    : vaultConfigured
      ? 'Create Soroban Vault'
      : 'Submit Direct Payments';
  const senderHistory = history.filter((remittance) => !senderPublicKey || remittance.senderPublicKey === senderPublicKey);
  const recipientHistory = history.filter((remittance) => !senderPublicKey || remittance.recipientAddress === senderPublicKey);
  const visibleHistory = activeView === 'sender' ? senderHistory : recipientHistory;
  const dashboardRemittance =
    visibleHistory.find((remittance) => remittance.id === activeRemittance?.id) || visibleHistory[0] || null;
  const dashboardTotals = dashboardRemittance ? getRemittanceTotals(dashboardRemittance) : null;

  if (screen === 'landing') {
    return (
      <main className="landing-shell">
        <section className="landing-hero">
          <div className="landing-copy">
            <img src="/padalasplit-mark.svg" alt="" className="brand-mark" />
            <p className="eyebrow">Stellar Testnet Remittance Vault</p>
            <h1>Send money home with a purpose, not just a memo.</h1>
            <p>
              PadalaSplit turns one OFW remittance into clear household buckets for groceries, tuition, bills,
              emergency funds, and savings. Locked buckets are enforceable through a Soroban vault; direct wallet
              payments are only a fallback for unlocked buckets.
            </p>
            <div className="landing-actions">
              <button type="button" className="primary-button" onClick={() => enterApp('sender')}>
                Start Sender Flow
                <ArrowRight size={18} />
              </button>
              <button type="button" className="secondary-button" onClick={() => enterApp('recipient')}>
                View Recipient Dashboard
              </button>
            </div>
          </div>

          <div className="landing-card">
            <div>
              <span>Demo split</span>
              <strong>100 XLM</strong>
            </div>
            <ul>
              <li><span>Groceries</span><strong>40 XLM</strong></li>
              <li><span>Tuition vault</span><strong>30 XLM</strong></li>
              <li><span>Bills vault</span><strong>20 XLM</strong></li>
              <li><span>Emergency vault</span><strong>10 XLM</strong></li>
            </ul>
            <p>Soroban vault buckets become vaulted, then withdrawable. Direct payments are fallback proof for unlocked buckets.</p>
          </div>
        </section>

        <section className="landing-steps">
          <article>
            <span>01</span>
            <h2>Split</h2>
            <p>Sender chooses recipient, amount, and bucket allocation.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Vault</h2>
            <p>Locked buckets are deposited into the Testnet Soroban vault for enforceable release timing.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Verify</h2>
            <p>Each proof links to Stellar Expert for transparent judging and demos.</p>
          </article>
          <article>
            <span>04</span>
            <h2>Reset</h2>
            <p>Demo history is clearable and reloads start fresh for clean presentations.</p>
          </article>
        </section>
      </main>
    );
  }

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
          <button type="button" className="secondary-button" onClick={() => setForm(createDemoForm(senderPublicKey || window.localStorage.getItem(WALLET_STORAGE_KEY) || undefined))}>
            Load Demo
          </button>
          <button type="button" className="secondary-button" onClick={() => setScreen('landing')}>
            Landing
          </button>
        </div>
      </section>

      <section className="view-switcher" aria-label="Dashboard view">
        <button
          type="button"
          className={activeView === 'sender' ? 'active' : ''}
          onClick={() => {
            setActiveView('sender');
            if (senderHistory[0]) setActiveRemittance(senderHistory[0]);
          }}
        >
          Sender
        </button>
        <button
          type="button"
          className={activeView === 'recipient' ? 'active' : ''}
          onClick={() => {
            setActiveView('recipient');
            if (recipientHistory[0]) setActiveRemittance(recipientHistory[0]);
          }}
        >
          Recipient
        </button>
      </section>

      <section className="status-row">
        <div className="status-item">
          <Database size={18} />
          <span>{isSupabaseConfigured() ? 'Supabase configured' : 'Supabase local fallback'}</span>
        </div>
        <div className="status-item">
          <ShieldCheck size={18} />
          <span>{senderPublicKey ? `Freighter connected ${senderPublicKey.slice(0, 6)}...${senderPublicKey.slice(-4)}` : 'Freighter not connected'}</span>
        </div>
        <div className="status-item">
          <LockKeyhole size={18} />
          <span>{vaultConfigured ? 'Soroban vault configured' : 'Soroban vault missing contract ID'}</span>
        </div>
        <div className="status-item">
          <CheckCircle2 size={18} />
          <span>{proofAvailable ? 'Testnet proof available' : 'No Testnet proof yet'}</span>
        </div>
        <button type="button" className="primary-button compact" onClick={handleConnectFreighter}>
          Connect Freighter
        </button>
      </section>

      {message && <div className="toast">{message}</div>}

      <section className="debug-panel">
        <div className="debug-heading">
          <div>
            <p className="eyebrow">Debug</p>
            <h2>Runtime Logs</h2>
          </div>
          <div className="debug-actions">
            <span className="network-pill">{debugLogs.length} events</span>
            <button type="button" className="secondary-button compact" onClick={() => setShowDebugLogs((current) => !current)}>
              <Bug size={16} />
              {showDebugLogs ? 'Hide Logs' : 'Show Logs'}
            </button>
            <button type="button" className="secondary-button compact" disabled={debugLogs.length === 0} onClick={handleCopyDebugLogs}>
              <Copy size={16} />
              Copy Logs
            </button>
            <button type="button" className="secondary-button compact danger-action" disabled={debugLogs.length === 0} onClick={handleClearDebugLogs}>
              <Trash2 size={16} />
              Clear Logs
            </button>
          </div>
        </div>
        {showDebugLogs && (
          <div className="debug-log-list">
            {debugLogs.length > 0 ? (
              debugLogs.slice(0, 20).map((entry) => (
                <article className={`debug-log-item ${entry.level}`} key={entry.id}>
                  <div>
                    <strong>{entry.level.toUpperCase()} · {entry.scope}</strong>
                    <time>{new Date(entry.timestamp).toLocaleTimeString()}</time>
                  </div>
                  <p>{entry.message}</p>
                  {entry.context && <pre>{JSON.stringify(entry.context, null, 2)}</pre>}
                  {entry.error && <pre>{entry.error.name ? `${entry.error.name}: ${entry.error.message}` : entry.error.message}</pre>}
                </article>
              ))
            ) : (
              <p className="muted">No logs yet.</p>
            )}
          </div>
        )}
      </section>

      {activeView === 'sender' && (
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
                  onClick={() =>
                    updateBucket(
                      bucket.id,
                      bucket.locked
                        ? { locked: false, unlockAt: undefined, releaseNote: 'Available immediately' }
                        : { locked: true, unlockAt: bucket.unlockAt || createDefaultUnlockAt() }
                    )
                  }
                >
                  {bucket.locked ? <LockKeyhole size={16} /> : <Unlock size={16} />}
                  {bucket.locked ? 'Locked' : 'Open'}
                </button>
                {bucket.locked ? (
                  <input
                    aria-label="Unlock date"
                    type="datetime-local"
                    value={bucket.unlockAt || ''}
                    onChange={(event) => updateBucket(bucket.id, { unlockAt: event.target.value })}
                  />
                ) : (
                  <div className="computed">Immediate</div>
                )}
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
              <div className={`process-card ${isSubmitting ? 'is-live' : ''}`}>
                <div>
                  <span>Current preview</span>
                  <strong>{activeRemittance.status}</strong>
                </div>
                <p>
                  {isSubmitting
                    ? vaultProgress?.message || 'Waiting for Freighter, RPC simulation, and Testnet confirmation.'
                    : activeIsVaultBacked
                      ? 'Vault is already created. Use the recipient dashboard for withdrawals.'
                      : vaultConfigured
                        ? 'Create a Soroban vault to enforce locked buckets. Vault buckets change to vaulted, then withdrawable.'
                        : 'Direct Testnet payments are available only when every bucket is unlocked. Configure the vault for locked buckets.'}
                </p>
                {vaultProgress?.hash && (
                  <a className="vault-link inline" href={getStellarExpertUrl(vaultProgress.hash)} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} />
                    Pending transaction
                  </a>
                )}
              </div>

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

              {getVaultProofUrl(activeRemittance) && (
                <a className="vault-link" href={getVaultProofUrl(activeRemittance)} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  Vault remittance transaction
                </a>
              )}

              <div className="proof-list">
                {activeRemittance.buckets.map((bucket) => {
                  return (
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
                      {bucket.withdrawalExpertUrl && (
                        <a className="icon-link" href={bucket.withdrawalExpertUrl} target="_blank" rel="noreferrer">
                          <ExternalLink size={16} />
                          Withdrawal
                        </a>
                      )}
                      {bucket.error && <p className="error-text">{bucket.error}</p>}
                    </article>
                  );
                })}
              </div>

              <div className="action-row">
                <button type="button" className="secondary-button" onClick={handleDemoProof}>
                  <Copy size={18} />
                  Demo Proof
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={submitDisabled}
                  onClick={vaultConfigured ? handleCreateVaultRemittance : handleSubmitPayments}
                >
                  {isSubmitting ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                  {submitButtonLabel}
                </button>
              </div>
              {directPaymentsBlocked && (
                <p className="error-text">
                  Locked buckets need the Soroban vault for enforceable release timing. Direct payments send funds straight to the recipient and are only a fallback for unlocked buckets.
                </p>
              )}
            </>
          ) : (
            <div className="empty-state">
              <CheckCircle2 size={32} />
              <p>Create a remittance preview to see payment proof and recipient dashboard data.</p>
            </div>
          )}
        </section>
      </div>
      )}

      <section className="panel dashboard-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{activeView === 'sender' ? 'Sender Dashboard' : 'Recipient Dashboard'}</p>
            <h2>{activeView === 'sender' ? 'Sent Remittances' : 'Family Budget View'}</h2>
          </div>
          <div className="panel-actions">
            <span className="network-pill">{visibleHistory.length} current</span>
            <button
              type="button"
              className="secondary-button compact danger-action"
              disabled={history.length === 0 || isSubmitting}
              onClick={handleClearHistory}
            >
              <RotateCcw size={16} />
              Reset Demo
            </button>
          </div>
        </div>

        {activeView === 'recipient' && dashboardRemittance && (
          <div className="recipient-detail">
            <div className="summary-grid">
              <div>
                <span>Total</span>
                <strong>{formatXlm(dashboardRemittance.totalAmount)} XLM</strong>
              </div>
              <div>
                <span>Available</span>
                <strong>{formatXlm(dashboardTotals?.availableTotal || 0)} XLM</strong>
              </div>
              <div>
                <span>Protected</span>
                <strong>{formatXlm(dashboardTotals?.lockedTotal || 0)} XLM</strong>
              </div>
            </div>
            {!isVaultBacked(dashboardRemittance) && isSorobanVaultConfigured() && (
              <div className="action-row">
                <button
                  type="button"
                  className="primary-button"
                  disabled={isSubmitting}
                  onClick={handleRecoverVault}
                >
                  {isSubmitting ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}
                  Recover Vault from Chain
                </button>
                <p className="muted">Check the Soroban contract for on-chain bucket data and restore withdraw access.</p>
              </div>
            )}
            <div className="proof-list">
              {dashboardRemittance.buckets.map((bucket) => {
                const nowSec = Math.floor(Date.now() / 1000);
                const isStillLocked =
                  isVaultBacked(dashboardRemittance) &&
                  bucket.paymentStatus !== 'withdrawn' &&
                  bucket.unlockTimestamp != null &&
                  bucket.unlockTimestamp > nowSec;
                const canWithdraw =
                  isVaultBacked(dashboardRemittance) &&
                  bucket.paymentStatus !== 'withdrawn' &&
                  (!bucket.unlockTimestamp || bucket.unlockTimestamp <= nowSec);
                const displayStatus = isStillLocked
                  ? 'vaulted'
                  : canWithdraw && bucket.paymentStatus !== 'withdrawn'
                    ? 'withdrawable'
                    : bucket.paymentStatus;

                return (
                  <article className={`proof-item${isStillLocked ? ' is-locked-bucket' : ''}`} key={bucket.id}>
                    <div>
                      <strong>{bucket.label}</strong>
                      <span>{bucket.locked ? bucket.releaseNote : 'Available immediately'}</span>
                    </div>
                    <div>
                      <strong>{formatXlm(bucket.amount)} XLM</strong>
                      <span>{bucket.unlockTimestamp ? new Date(bucket.unlockTimestamp * 1000).toLocaleString() : 'No unlock time'}</span>
                    </div>
                    <span className={`payment-chip ${displayStatus}`}>{displayStatus}</span>
                    {bucket.stellarExpertUrl ? (
                      <a className="icon-link" href={bucket.stellarExpertUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={16} />
                        Proof
                      </a>
                    ) : (
                      <span className="muted">No proof yet</span>
                    )}
                    {isVaultBacked(dashboardRemittance) && bucket.paymentStatus !== 'withdrawn' && (
                      isStillLocked ? (
                        <span className="locked-badge">
                          <LockKeyhole size={14} />
                          Locked until {new Date((bucket.unlockTimestamp ?? 0) * 1000).toLocaleString()}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button compact"
                          disabled={!canWithdraw || withdrawingBucketId === bucket.id}
                          onClick={() => handleWithdrawBucket(bucket)}
                        >
                          {withdrawingBucketId === bucket.id ? <Loader2 className="spin" size={16} /> : <Unlock size={16} />}
                          Withdraw
                        </button>
                      )
                    )}
                    {bucket.withdrawalExpertUrl && (
                      <a className="icon-link" href={bucket.withdrawalExpertUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={16} />
                        Withdrawal
                      </a>
                    )}
                    {bucket.error && <p className="error-text">{bucket.error}</p>}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {visibleHistory.length > 0 ? (
          <div className="history-grid">
            {visibleHistory.map((remittance) => (
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
            <p>
              {history.length === 0
                ? 'No transactions in this demo session. Reloading the page starts clean.'
                : `No ${activeView} remittances in the current session.`}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

const isVaultBacked = (remittance: RemittanceRecord) =>
  Boolean(remittance.vaultContractId || remittance.buckets.some((bucket) => bucket.contractBucketId));

const getVaultProofUrl = (remittance: RemittanceRecord) =>
  remittance.vaultExpertUrl || remittance.buckets.find((bucket) => bucket.contractBucketId)?.stellarExpertUrl;

const normalizeInterruptedSubmission = (remittance: RemittanceRecord): RemittanceRecord => {
  if (remittance.status !== 'submitting') return remittance;

  // If the remittance was submitted to the Soroban vault but the
  // on-chain confirmation was interrupted (e.g. page refresh), recover
  // it as vault-backed instead of marking every bucket as failed.
  if (isVaultBacked(remittance)) {
    return applyVaultMetadata(
      remittance,
      remittance.vaultTransactionHash
        ? { hash: remittance.vaultTransactionHash, stellarExpertUrl: remittance.vaultExpertUrl || getStellarExpertUrl(remittance.vaultTransactionHash) }
        : undefined
    );
  }

  return {
    ...remittance,
    status: 'partial',
    buckets: remittance.buckets.map((bucket) =>
      bucket.paymentStatus === 'submitting'
        ? {
            ...bucket,
            paymentStatus: 'failed',
            error: 'Previous submission was interrupted. Create a new preview before submitting again.'
          }
        : bucket
    )
  };
};

export default App;
