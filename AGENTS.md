# Repository Guidelines

## Project Goal & Product Workflow

PadalaSplit is a Stellar-powered remittance web app for Overseas Filipino Workers and Filipino families. The goal is purpose-based remittance: instead of sending one untracked amount, the sender allocates money into labeled buckets such as groceries, tuition, bills, savings, and emergency funds.

For the MVP, use Stellar Testnet and XLM to demonstrate the full split-remittance flow:

1. Sender enters a recipient Stellar wallet address, total amount, and bucket allocations.
2. App calculates the XLM amount for each bucket.
3. App submits separate Stellar Testnet payment transactions, one per bucket.
4. Each transaction includes a memo identifying the bucket purpose.
5. Recipient dashboard shows totals by bucket, transaction hashes, and Stellar Expert links.

Focus track: Payments & Remittances. One-line description: Purpose-based Stellar remittances for OFWs and Filipino families.

## Team Roles

- Yuan Rubio - Project Lead / Full-stack Developer
- Rex Jumawid - Stellar Integration / Backend Developer

## Project Structure & Module Organization

This is a fresh Git project with no application scaffold committed yet. As PadalaSplit grows, keep the layout aligned to the product workflow:

- `src/` for application source code.
- `tests/` for unit and integration tests.
- `public/` or `assets/` for static images, icons, and other client assets.
- `contracts/` for Stellar smart contracts, if the project includes Soroban code.
- `docs/` for product notes, deployment links, demos, architecture decisions, and hackathon context.

Group feature code by domain when possible, for example `src/remittances/`, `src/buckets/`, `src/stellar/`, and `src/wallets/`.

Before planning major work, check the copied local references in `docs/hackathon/` for hackathon setup guides, checkpoint rules, and submission requirements. Use those local files as the default source of truth instead of fetching remote GitHub files again.

Before planning feature work, also check `local-context/FEATURES.md`. It is the current source of truth for planned PadalaSplit features, recommended 8-hour MVP scope, demo mode, remittance protection ideas, and future backlog.

## Build, Test, and Development Commands

No build system is committed yet. Add commands to this section when a framework or toolchain is introduced. Prefer standard scripts such as:

- `npm install` to install frontend dependencies.
- `npm run dev` to start a local development server.
- `npm run build` to create a production build.
- `npm test` to run the test suite.
- `stellar contract build` or project-specific Soroban commands for contract builds.

Document required environment variables in `.env.example`, not in this file.

## Stellar Integration Notes

The MVP should use Stellar as the payment and verification layer. Each bucket is represented by a separate Testnet payment, such as 40 XLM for groceries, 30 XLM for tuition, 20 XLM for bills, and 10 XLM for emergency savings. Save every transaction hash with its bucket label and expose a Stellar Expert verification link.

Protection features such as locked buckets, scheduled releases, and sender approval are product goals. For the 8-hour MVP, implement locked buckets as a UI simulation unless a later task explicitly adds Soroban contracts, backend automation, app-controlled vaults, or direct-to-biller payment enforcement.

Future versions may support stablecoins, PHP-pegged assets, wallet integrations, and Soroban-based allocation rules.

## Coding Style & Naming Conventions

Follow the project formatter and linter once added. Until then, use 2-space indentation for JavaScript, TypeScript, JSON, CSS, and Markdown. Use clear names:

- Components: `PascalCase`, for example `PaymentSummary.tsx`.
- Functions and variables: `camelCase`, for example `calculateSplitAmount`.
- Environment variables: `UPPER_SNAKE_CASE`, for example `STELLAR_NETWORK`.
- Test files: match the source name, for example `payment-summary.test.ts`.

Keep modules small and avoid unrelated refactors in feature commits.

## Testing Guidelines

Add tests with each behavior change. Unit tests should cover allocation math, validation, memo labels, and state transitions. Integration tests should cover wallet connection, transaction submission, and settlement flows when those features exist.

Use deterministic fixtures for Stellar accounts and transactions. Never depend on live mainnet state in automated tests.

## Commit & Pull Request Guidelines

This repository has no commit history yet, so use concise conventional-style messages from the start, for example:

- `feat: scaffold payment split flow`
- `fix: validate recipient amounts`
- `docs: add testnet deployment notes`

Pull requests should include a summary, tests performed, screenshots for UI changes, and links to related issues or hackathon tasks. For contract changes, include the testnet deployment address and exact deploy command.

## Security & Configuration Tips

Never commit private keys, seed phrases, API tokens, or populated `.env` files. Use testnet accounts for development and isolate mainnet configuration behind explicit environment variables.
