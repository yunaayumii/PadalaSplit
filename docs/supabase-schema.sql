create table if not exists public.remittances (
  id uuid primary key,
  session_id text not null,
  sender_name text not null,
  sender_public_key text,
  recipient_name text not null,
  recipient_address text not null,
  total_amount numeric not null,
  status text not null,
  buckets jsonb not null,
  created_at timestamptz not null default now()
);

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
