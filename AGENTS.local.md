# Local Agent Notes

## Purpose

This file contains shared local guidance for working on PadalaSplit. It is committed so teammates can see hackathon-specific context, setup notes, checkpoint requirements, and implementation decisions that may change quickly.

## Context Intake Workflow

When new hackathon or product-planning files are added, read those local copies before planning or implementing. Prioritize:

1. Hackathon rules, judging criteria, and checkpoint requirements.
2. Product feature scope and MVP priorities.
3. Stellar Testnet setup instructions.
4. Wallet, funding, Horizon, Stellar Expert, or Soroban setup notes.
5. Deployment requirements and demo submission instructions.
6. Any files describing required deliverables, timelines, or scoring rubrics.

After reading new context files, summarize:

- Required deliverables.
- MVP feature scope.
- Technical constraints.
- Required Stellar integration details.
- Deadlines or checkpoint expectations.
- Any risks, blockers, or missing credentials.

## Local Context Folder

Use `docs/hackathon/` for public hackathon references that should be committed with the repo. Use `local-context/` for shared working notes and copied local context that teammates should be able to read. Prefer `docs/hackathon/` for README formats, setup guides, checkpoint notes, judging rubrics, and public deployment requirements so future agents can work from local files without network access.

Do not store wallet secrets, seed phrases, private keys, API tokens, or funded account credentials in `local-context/`.

## Product Feature Context

Primary feature plan:

- `local-context/FEATURES.md`

Use this file as the source of truth for PadalaSplit feature scope when it conflicts with older short MVP summaries. The current 8-hour MVP should cover:

1. Create remittance form.
2. Bucket split calculator.
3. Stellar Testnet split payments.
4. Recipient dashboard.
5. Transaction proof links.
6. Locked bucket UI simulation.
7. Demo mode.

Important implementation interpretation: protection features such as locked buckets, scheduled releases, sender approval, direct-to-biller routing, and spending confirmation are product goals, but only locked bucket UI simulation is in the recommended 8-hour MVP. Do not imply that direct payments to a recipient wallet can enforce spending restrictions. Enforceable locks require app-controlled vaults, backend automation, direct-to-biller payments, or Soroban smart contracts in later versions.

## Known Hackathon Guide Context

Local reference guide:

- `docs/hackathon/stellar-soroban-mainnet-guide.md`

Current summary: the copied guide is a Stellar Soroban mainnet deployment guide. It covers Rust installation, `wasm32v1-none`, Stellar CLI installation, mainnet network configuration, deployer identity setup, contract build/upload/deploy/invoke commands, TTL extension, Stellar Asset Contract deployment, Stellar Expert verification, fee estimation, security practices, and common errors.

Important interpretation for PadalaSplit: the MVP should still default to Stellar Testnet and XLM for safe demonstration unless hackathon instructions explicitly require mainnet deployment. Treat the mainnet guide as deployment-readiness context, not permission to use real funds or commit secrets.

Do not fetch the remote hackathon repository again by default. If a needed format or guide is missing locally, ask the user to add it to `docs/hackathon/` or explicitly approve fetching it.

## Current Product Direction

PadalaSplit is an OFW remittance split wallet for Stellar. The MVP should demonstrate purpose-based remittances using Stellar Testnet and XLM.

Core flow:

1. Sender enters recipient details, recipient wallet, total amount, and budget bucket allocations.
2. App calculates per-bucket XLM amounts and validates that allocations total the full remittance.
3. App shows a confirmation preview before payment submission.
4. App submits separate Stellar Testnet payments, one per bucket.
5. Each payment includes a memo naming the bucket.
6. App stores and displays transaction hashes with Stellar Expert Testnet links.
7. Recipient dashboard groups received amounts by bucket and shows transaction proof.

## Planning Rule

Before building major features, check whether `local-context/FEATURES.md` or new hackathon context files change the implementation priority. If there is a conflict between old assumptions and newer local context, prioritize the newer local context and call out the change.

## Private Notes Policy

Do not place secrets in this file. Never store seed phrases, private keys, API keys, funded wallet secrets, or production credentials here. Use `.env` for local environment values and keep `.env` ignored.
