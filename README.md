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
- Locked bucket simulation — show protected funds in the UI while keeping on-chain enforcement as a future Soroban or backend feature.

See `docs/features.md` for the full MVP feature plan and future roadmap.

## 🛠️ Tech Stack

- Frontend: Vite, React, TypeScript
- Backend: Supabase for persisted demo history, with browser local storage fallback when Supabase is not configured
- Blockchain: Stellar Testnet, XLM, Stellar SDK, Horizon API
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

### Supabase Setup

Run the SQL in `docs/supabase-schema.sql` in the Supabase SQL editor. The MVP uses demo session IDs instead of full authentication, so the included policies are intentionally permissive for hackathon demo use only.

### Freighter Setup

Install the Freighter browser extension, switch it to Stellar Testnet, and fund the sender account with Testnet XLM before submitting real split payments. Demo proof mode works without Freighter but only generates mock hashes.

## 🌐 Deployment

### Testnet

- Contract / App Address: Not required for the payment-operation MVP
- 📸 Screenshot — Stellar Expert (Testnet): To be added

### Mainnet

- Contract / App Address: Not yet deployed
- 📸 Screenshot — Stellar Expert (Mainnet): Not yet available

## 🎥 Demo

- 🔗 Live App: To be added
- 🎬 Demo Video: To be added
- 🖼️ Pitch Deck: To be added

## 👨‍💻 Team

| Name | Role | GitHub |
|---|---|---|
| Yuan Rubio | Project Lead / Full-stack Developer | To be added |
| Rex Jumawid | Stellar Integration / Backend Developer | To be added |

## 📜 License

MIT
