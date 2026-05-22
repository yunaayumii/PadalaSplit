# PadalaSplit

Purpose-based Stellar remittances for OFWs and Filipino families.

## 🧩 Problem

Overseas Filipino Workers regularly send money home to support their families in the Philippines, but the money is often managed manually after it is received. Families may need to divide one remittance across groceries, bills, tuition, savings, and emergency needs, which can lead to confusion, overspending, or lack of visibility for the sender.

PadalaSplit addresses the lack of transparent, purpose-based allocation in family remittances.

## 🌟 Vision

PadalaSplit aims to make remittances more transparent, intentional, and useful for Filipino households. In the long term, the project can help OFWs and families manage financial support with clearer records, stronger trust, and better household budgeting.

## 🎯 Purpose

We built PadalaSplit to help OFWs send money home with context, not just value. The mission is to make every remittance easier to understand by showing what each portion is meant for and giving both sender and recipient verifiable payment records.

## 👥 Target Users

- OFW Sender — an Overseas Filipino Worker who sends money home and wants clearer visibility into how the remittance is allocated.
- Family Recipient — a family member in the Philippines who receives remittances and manages household needs such as groceries, bills, tuition, savings, and emergencies.

## ✨ Features

- Purpose-based remittance form — enter a total amount and split it into labeled budget buckets.
- Automatic allocation calculation — calculate the XLM amount for each bucket based on sender-defined allocations.
- Stellar Testnet payments — send separate XLM payments for each bucket using Stellar transaction memos.
- Recipient dashboard — view received amounts grouped by purpose.
- Transaction proof — display transaction hashes and Stellar Expert links for verification.
- Demo mode — prefilled remittance data for a smooth hackathon presentation.
- Locked bucket vault — optional Soroban contract flow that escrows bucket funds and lets the recipient withdraw after each unlock time.

See `docs/features.md` for the full MVP feature plan and future roadmap.

## 🛠️ Tech Stack

- Frontend: Vite, React, TypeScript
- Backend: Supabase for persisted demo history, with browser local storage fallback when Supabase is not configured
- Blockchain: Stellar Testnet, XLM, Stellar SDK, Horizon API
- Smart contract: Soroban vault contract for time-locked XLM buckets
- Wallet: Freighter for Testnet transaction signing
- Other tools: Stellar Expert for transaction verification

## 🚀 How to Run Locally

Install dependencies and start the Vite dev server:

```bash
npm install
npm run dev
```

Create a local environment file from the example:

```bash
cp .env.example .env.local
```

Required for Supabase persistence:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

If Supabase is not configured, the app still runs with browser local storage for demo history.

Optional for Soroban locked buckets:

- `VITE_SOROBAN_RPC_URL`
- `VITE_PADALASPLIT_VAULT_CONTRACT_ID`
- `VITE_DEMO_RECIPIENT_ADDRESS`

If the vault contract ID is not configured, the app only allows direct Stellar Testnet payments for remittances where every bucket is unlocked. Locked buckets are intended to be enforced through the Soroban vault.

### Supabase Setup

Run the SQL in `docs/supabase-schema.sql` in the Supabase SQL editor. The MVP uses demo session IDs instead of full authentication, so the included policies are intentionally permissive for hackathon demo use only.

### Freighter Setup

Install the Freighter browser extension, switch it to Stellar Testnet, and fund the sender account with Testnet XLM before submitting real split payments. Demo proof mode works without Freighter but only generates mock hashes.

### Soroban Vault Setup

See `docs/soroban-vault.md` to build, deploy, initialize, and configure the locked-bucket vault contract.

## 🧪 Soroban-First Demo Runbook

PadalaSplit’s judge-facing demo should use the Soroban vault as the primary path. Direct payments are kept as a fallback only for unlocked buckets.

### Deployment Values To Fill

| Value | Placeholder |
|---|---|
| Vercel app URL | `https://padalasplit-testnet.vercel.app/` |
| Testnet vault contract ID | `CBZ5PWU5NYF4BNHYXEAJD3CU6WPBK7TZ225V6XZMBKQMPWOH44K7QN7L` |
| Funded recipient public key | `<FUNDED_RECIPIENT_PUBLIC_KEY>` |
| Vault creation transaction hash | `<VAULT_CREATION_TX_HASH>` |
| Withdrawal transaction hash | `<WITHDRAWAL_TX_HASH>` |

### Demo Steps

1. Configure Vercel environment variables:
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, if using Supabase persistence.
   - `VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org`.
   - `VITE_PADALASPLIT_VAULT_CONTRACT_ID=CBZ5PWU5NYF4BNHYXEAJD3CU6WPBK7TZ225V6XZMBKQMPWOH44K7QN7L`.
   - `VITE_DEMO_RECIPIENT_ADDRESS=<FUNDED_RECIPIENT_PUBLIC_KEY>`.
2. Configure funded Testnet sender and recipient wallets in Freighter. Keep all secret keys and funded account credentials outside the repo.
3. Create a Vercel preview and open `https://padalasplit-testnet.vercel.app/`.
4. Connect the sender wallet, load the demo, preview the remittance, and click `Create Soroban Vault`.
5. Switch Freighter to the recipient wallet and open the recipient dashboard.
6. Withdraw an unlocked bucket after its unlock time.
7. Open the Stellar Expert proof links for `<VAULT_CREATION_TX_HASH>` and `<WITHDRAWAL_TX_HASH>`.

For contract build, deploy, and init commands, follow `docs/soroban-vault.md`.

## 🌐 Deployment

### Testnet

- App URL: `https://padalasplit-testnet.vercel.app/`
- Vault Contract ID: `CBZ5PWU5NYF4BNHYXEAJD3CU6WPBK7TZ225V6XZMBKQMPWOH44K7QN7L`
- Funded Recipient Public Key: `<FUNDED_RECIPIENT_PUBLIC_KEY>`
- Vault Creation Transaction: `<VAULT_CREATION_TX_HASH>`
- Withdrawal Transaction: `<WITHDRAWAL_TX_HASH>`
- 📸 Screenshot — Stellar Expert (Testnet): To be added

### Mainnet

- App URL: `https://padala-split.vercel.app`
- Contract / App Address: Not yet deployed (Fallback Simulation Mode Active)
- 📸 Screenshot — Stellar Expert (Mainnet): Not yet available

## 🎥 Demo

- 🔗 Live App (Mainnet): [padala-split.vercel.app](https://padala-split.vercel.app)
- 🧪 Staging App (Testnet): [padalasplit-testnet.vercel.app](https://padalasplit-testnet.vercel.app/)
- 🎬 Demo Video: To be added
- 🖼️ Pitch Deck: To be added

## 👨‍💻 Team

| Name | Role | GitHub |
|---|---|---|
| Yuan Rubio | Project Lead / Full-stack Developer | [@yunaayumii](https://github.com/yunaayumii) |
| Rex Jumawid | Stellar Integration / Backend Developer | [@rexjumawid](https://github.com/rexjumawid) |

## 📜 License

MIT
