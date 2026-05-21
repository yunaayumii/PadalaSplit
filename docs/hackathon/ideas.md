# Stellar Hackathon PH 2026 Ideas

Hackathon theme: real-world financial solutions for Filipinos. The strongest ideas should clearly improve how money moves, grows, or is accessed for OFWs, MSMEs, unbanked users, or everyday Filipino households.

## 1. OFW Remittance Split Wallet

**Problem:** OFWs often send money home for multiple purposes, but families may need manual tracking for bills, school fees, savings, and emergency funds.

**Solution:** A remittance wallet that lets an OFW send one transfer and automatically split it into labeled buckets for family needs.

**Stellar Use:** Use Stellar payments on testnet/mainnet, stablecoin assets, and memo-based transaction references. Optional Soroban contract can enforce programmable allocation rules.

**MVP Scope:**
- Sender creates family wallet profile.
- Sender enters amount and bucket percentages.
- App submits Stellar payment transactions.
- Recipient dashboard shows received funds by purpose.
- Transaction history links to Stellar Expert.

**Why It Can Win:** Strong real-world impact, simple demo flow, clear Stellar payment integration.

## 2. MSME Stablecoin Invoice Pay

**Problem:** Small businesses struggle with late payments, manual reconciliation, and limited digital payment options.

**Solution:** A lightweight invoice app where MSMEs create invoices payable in a peso-pegged stablecoin or test asset on Stellar.

**Stellar Use:** Generate payment requests, track invoice status by watching Stellar transactions, and settle payments to the merchant wallet.

**MVP Scope:**
- Merchant creates invoice with amount, customer, and due date.
- App generates payment link or QR code.
- Customer pays through a Stellar wallet.
- Invoice status updates from unpaid to paid.
- Merchant dashboard shows cashflow.

**Why It Can Win:** Fits MSME commerce track, easy to explain to judges, UX can be polished quickly.

## 3. Instant Barangay Aid Disbursement

**Problem:** Cash aid distribution can be slow, opaque, and hard to audit.

**Solution:** A disbursement tool for barangays or NGOs to send digital aid to verified recipients instantly.

**Stellar Use:** Batch Stellar payments, recipient wallet records, and public transaction audit trails.

**MVP Scope:**
- Admin uploads or enters recipient list.
- Admin selects aid amount.
- App sends batch testnet payments.
- Recipients view claim status.
- Public audit page shows anonymized transaction records.

**Why It Can Win:** High social impact and strong alignment with financial inclusion.

## 4. Sari-Sari Store Cashflow Tracker With Stellar Payments

**Problem:** Micro-merchants often mix personal and business cash, making it hard to understand daily profit and inventory needs.

**Solution:** A simple sales and payment tracker where stores can accept Stellar payments and see daily cashflow.

**Stellar Use:** Accept payments to merchant wallet, show transaction confirmation, and reconcile sales with wallet activity.

**MVP Scope:**
- Store owner creates products or quick-sale amounts.
- Customer pays via QR code.
- Owner sees paid/unpaid sales.
- Daily summary shows revenue, expenses, and net cashflow.
- Exportable transaction report.

**Why It Can Win:** Practical, demo-friendly, and relevant to everyday Filipino MSMEs.

## 5. Peso Savings Goal Vault

**Problem:** Many people want to save for tuition, rent, emergencies, or gadgets, but lack simple goal-based financial tools.

**Solution:** A goal-based wallet that lets users deposit small amounts into savings vaults and track progress.

**Stellar Use:** Stellar asset balances represent saved funds. Optional Soroban contract can lock funds until a target date or target amount.

**MVP Scope:**
- User creates savings goal.
- User deposits testnet funds.
- Dashboard tracks progress.
- Optional early-withdraw warning or lock rule.
- Transaction history proves deposits.

**Why It Can Win:** Feasible MVP with strong UX potential and clear everyday usefulness.

## 6. Freelancer Cross-Border Pay Request

**Problem:** Filipino freelancers often face delays and fees when receiving international payments.

**Solution:** A payment request tool for freelancers to send clients a stablecoin invoice and receive near-instant settlement.

**Stellar Use:** Stellar payment rails, invoice metadata, QR/payment link, and wallet balance tracking.

**MVP Scope:**
- Freelancer creates a client payment request.
- Client pays using testnet wallet flow.
- Freelancer sees payment confirmation.
- App generates receipt.
- Dashboard tracks paid and pending requests.

**Why It Can Win:** Clear target user, strong payments story, easy pitch.

## 7. Cooperative Microloan Repayment Tracker

**Problem:** Small cooperatives and lending groups need transparent repayment tracking without expensive software.

**Solution:** A repayment dashboard where borrowers repay microloans through Stellar and groups can monitor balances.

**Stellar Use:** Payments track repayments, transaction history creates auditability, and optional Soroban contract can define repayment schedules.

**MVP Scope:**
- Coop admin creates borrower account and loan record.
- Borrower pays installment.
- Dashboard updates remaining balance.
- Late or missed payments are highlighted.
- Transaction proofs link to Stellar explorer.

**Why It Can Win:** Blends inclusion, feasibility, and blockchain transparency.

## 8. Tuition Remittance Tracker

**Problem:** OFW parents sending tuition money need confidence that funds are allocated correctly and paid on time.

**Solution:** A remittance tracker focused on education expenses, with school fee goals and payment confirmations.

**Stellar Use:** Payments for tuition buckets, transaction proofs, and optional escrow until due date.

**MVP Scope:**
- Parent creates student profile and tuition goal.
- Parent sends funds to education bucket.
- Guardian marks school payment as completed.
- App stores receipts or confirmation notes.
- Dashboard shows upcoming due dates.

**Why It Can Win:** Emotionally strong use case with concrete financial workflow.

## Recommended Top 3

1. **MSME Stablecoin Invoice Pay** - best balance of feasibility, Stellar execution, and demo clarity.
2. **OFW Remittance Split Wallet** - strongest story for Filipino families and payments.
3. **Instant Barangay Aid Disbursement** - highest social impact if executed cleanly.

## Best MVP Pick

Build **MSME Stablecoin Invoice Pay** if the goal is to maximize the chance of finishing a polished working product by demo day.

Core demo script:
1. Merchant creates an invoice.
2. App generates a Stellar payment request.
3. Customer pays on Stellar testnet.
4. Invoice automatically updates to paid.
5. Merchant sees the transaction and cashflow summary.

This directly addresses MSME commerce, uses Stellar in an obvious way, and can produce the required testnet/mainnet screenshots.
