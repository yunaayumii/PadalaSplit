import { createClient } from '@supabase/supabase-js';
import type { RemittanceRecord } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const STORAGE_KEY = 'padalasplit.remittances';

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const toDatabaseRecord = (remittance: RemittanceRecord) => ({
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
});

const fromDatabaseRecord = (record: Record<string, unknown>): RemittanceRecord => ({
  id: String(record.id),
  sessionId: String(record.session_id),
  senderName: String(record.sender_name),
  senderPublicKey: record.sender_public_key ? String(record.sender_public_key) : undefined,
  recipientName: String(record.recipient_name),
  recipientAddress: String(record.recipient_address),
  totalAmount: Number(record.total_amount),
  status: record.status as RemittanceRecord['status'],
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

export const isSupabaseConfigured = () => Boolean(supabase);

export const saveRemittance = async (remittance: RemittanceRecord) => {
  if (supabase) {
    const { error } = await supabase.from('remittances').upsert(toDatabaseRecord(remittance));
    if (error) throw error;
    return remittance;
  }

  const records = readLocalRecords().filter((record) => record.id !== remittance.id);
  records.unshift(remittance);
  writeLocalRecords(records);
  return remittance;
};

export const listRemittances = async (sessionId: string) => {
  if (supabase) {
    const { data, error } = await supabase
      .from('remittances')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((record) => fromDatabaseRecord(record));
  }

  return readLocalRecords().filter((record) => record.sessionId === sessionId);
};
