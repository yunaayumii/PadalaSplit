import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logDebug, logWarn } from './logger';
import type { RemittanceRecord } from './types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const STORAGE_KEY = 'padalasplit.remittances';

/**
 * Singleton Supabase client.
 * Avoids "Multiple GoTrueClient instances" warnings that occur when
 * Vite HMR re-executes this module and creates duplicate clients.
 */
let _supabase: SupabaseClient | null = null;

const getSupabase = (): SupabaseClient | null => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabase;
};

/**
 * Build the database row object.
 * Vault-related columns are only included when they carry a value so the
 * upsert doesn't fail with PGRST204 if the Supabase table was created
 * without those columns.
 */
const toDatabaseRecord = (remittance: RemittanceRecord) => {
  const row: Record<string, unknown> = {
    id: remittance.id,
    session_id: remittance.sessionId,
    sender_name: remittance.senderName,
    sender_public_key: remittance.senderPublicKey,
    recipient_name: remittance.recipientName,
    recipient_address: remittance.recipientAddress,
    total_amount: remittance.totalAmount,
    status: remittance.status,
    buckets: remittance.buckets,
    created_at: remittance.createdAt
  };

  // Only include vault columns if we actually have data — avoids
  // "Could not find the 'vault_contract_id' column" errors.
  if (remittance.vaultContractId) row.vault_contract_id = remittance.vaultContractId;
  if (remittance.vaultTransactionHash) row.vault_transaction_hash = remittance.vaultTransactionHash;
  if (remittance.vaultExpertUrl) row.vault_expert_url = remittance.vaultExpertUrl;

  return row;
};

const fromDatabaseRecord = (record: Record<string, unknown>): RemittanceRecord => ({
  id: String(record.id),
  sessionId: String(record.session_id),
  senderName: String(record.sender_name),
  senderPublicKey: record.sender_public_key ? String(record.sender_public_key) : undefined,
  recipientName: String(record.recipient_name),
  recipientAddress: String(record.recipient_address),
  totalAmount: Number(record.total_amount),
  status: record.status as RemittanceRecord['status'],
  vaultContractId: record.vault_contract_id ? String(record.vault_contract_id) : undefined,
  vaultTransactionHash: record.vault_transaction_hash ? String(record.vault_transaction_hash) : undefined,
  vaultExpertUrl: record.vault_expert_url ? String(record.vault_expert_url) : undefined,
  buckets: record.buckets as RemittanceRecord['buckets'],
  createdAt: String(record.created_at)
});

const readLocalRecords = (): RemittanceRecord[] => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as RemittanceRecord[];
  } catch {
    return [];
  }
};

const writeLocalRecords = (records: RemittanceRecord[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

export const isSupabaseConfigured = () => Boolean(getSupabase());

export const saveRemittance = async (remittance: RemittanceRecord) => {
  logDebug('storage.save', 'Saving remittance.', {
    remittanceId: remittance.id,
    status: remittance.status,
    supabaseConfigured: Boolean(getSupabase())
  });
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from('remittances').upsert(toDatabaseRecord(remittance));
      if (error) {
        // If the error is about missing columns, fall through to local storage.
        if (error.code === 'PGRST204') {
          logWarn('storage.save', 'Supabase table is missing columns, falling back to local storage.', {
            remittanceId: remittance.id,
            code: error.code
          }, error);
        } else {
          throw error;
        }
      } else {
        return remittance;
      }
    } catch (err) {
      // Re-throw non-column errors
      const pgError = err as { code?: string; message?: string };
      if (pgError.code !== 'PGRST204') throw err;
      logWarn('storage.save', 'Supabase table is missing columns, falling back to local storage.', {
        remittanceId: remittance.id,
        code: pgError.code
      }, err);
    }
  }

  const records = readLocalRecords().filter((record) => record.id !== remittance.id);
  records.unshift(remittance);
  writeLocalRecords(records);
  return remittance;
};

export const listRemittances = async (sessionId: string) => {
  logDebug('storage.listSession', 'Listing remittances for session.', {
    sessionId,
    supabaseConfigured: Boolean(getSupabase())
  });
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('remittances')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) {
        logWarn('storage.listSession', 'Supabase query failed, falling back to local storage.', { sessionId }, error);
      } else {
        return (data || []).map((record) => fromDatabaseRecord(record));
      }
    } catch (err) {
      logWarn('storage.listSession', 'Supabase query failed, falling back to local storage.', { sessionId }, err);
    }
  }

  return readLocalRecords().filter((record) => record.sessionId === sessionId);
};

export const listRemittancesForWallet = async (walletAddress: string) => {
  if (!walletAddress) return [];

  logDebug('storage.listWallet', 'Listing remittances for wallet.', {
    walletAddress,
    supabaseConfigured: Boolean(getSupabase())
  });
  const supabase = getSupabase();
  if (supabase) {
    try {
      const [senderResult, recipientResult] = await Promise.all([
        supabase.from('remittances').select('*').eq('sender_public_key', walletAddress),
        supabase.from('remittances').select('*').eq('recipient_address', walletAddress)
      ]);

      if (senderResult.error) throw senderResult.error;
      if (recipientResult.error) throw recipientResult.error;

      const records = [...(senderResult.data || []), ...(recipientResult.data || [])]
        .map((record) => fromDatabaseRecord(record))
        .filter((record, index, records) => records.findIndex((candidate) => candidate.id === record.id) === index)
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

      return records;
    } catch (err) {
      logWarn('storage.listWallet', 'Supabase wallet query failed, falling back to local storage.', { walletAddress }, err);
    }
  }

  return readLocalRecords()
    .filter((record) => record.senderPublicKey === walletAddress || record.recipientAddress === walletAddress)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
};

export const clearRemittances = async (remittanceIds: string[]) => {
  logDebug('storage.clear', 'Clearing remittances.', {
    count: remittanceIds.length,
    supabaseConfigured: Boolean(getSupabase())
  });
  if (remittanceIds.length === 0) {
    clearLocalRemittances();
    return;
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from('remittances').delete().in('id', remittanceIds);
      if (error) {
        logWarn('storage.clear', 'Supabase delete failed, clearing local storage instead.', {
          count: remittanceIds.length
        }, error);
      } else {
        return;
      }
    } catch (err) {
      logWarn('storage.clear', 'Supabase delete failed, clearing local storage instead.', {
        count: remittanceIds.length
      }, err);
    }
  }

  const remaining = readLocalRecords().filter((record) => !remittanceIds.includes(record.id));
  writeLocalRecords(remaining);
};

export const clearLocalRemittances = () => {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem('padalasplit.sessionId');
};
