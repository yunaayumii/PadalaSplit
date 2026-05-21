create table if not exists public.remittances (
  id uuid primary key,
  session_id text not null,
  sender_name text not null,
  sender_public_key text,
  recipient_name text not null,
  recipient_address text not null,
  total_amount numeric not null,
  status text not null,
  vault_contract_id text,
  vault_transaction_hash text,
  vault_expert_url text,
  buckets jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.remittances
  add column if not exists vault_contract_id text;

alter table public.remittances
  add column if not exists vault_transaction_hash text;

alter table public.remittances
  add column if not exists vault_expert_url text;

create index if not exists remittances_session_id_created_at_idx
  on public.remittances (session_id, created_at desc);

alter table public.remittances enable row level security;

create policy "Allow demo read access"
  on public.remittances
  for select
  using (true);

create policy "Allow demo insert access"
  on public.remittances
  for insert
  with check (true);

create policy "Allow demo update access"
  on public.remittances
  for update
  using (true)
  with check (true);

create policy "Allow demo delete access"
  on public.remittances
  for delete
  using (true);
