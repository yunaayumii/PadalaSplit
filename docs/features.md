# PadalaSplit Feature Plan

PadalaSplit is a purpose-based remittance app for OFWs and Filipino families. It helps senders split money by household purpose, gives recipients clear visibility, and reduces the risk that critical funds are spent all at once.

## Product Goal

Help OFWs send money home with structure and trust. Instead of sending one lump sum that the family must manually manage, PadalaSplit divides a remittance into labeled buckets such as groceries, tuition, bills, savings, and emergency funds.

## Core MVP

1. Create a remittance with sender name, recipient name, recipient Stellar wallet address, total amount, and bucket allocations.
2. Calculate bucket amounts from percentages or fixed amounts and validate that allocations equal the full remittance.
3. Submit separate Stellar Testnet XLM payments, one per bucket, with the bucket label in the transaction memo.
4. Store transaction hashes and expose Stellar Expert Testnet links for judge-verifiable proof.
5. Show a recipient dashboard grouped by purpose, status, sender, date, and transaction history.
6. Provide demo mode with a sample 100 XLM remittance and preset family budget split.
7. Simulate locked bucket status in the UI for protected funds.

## Protection Model

If funds are sent directly to the recipient wallet, PadalaSplit cannot enforce spending restrictions. The MVP shows locked buckets as product intent and UI status only. Enforceable protection requires a future implementation using app-controlled vaults, Soroban smart contracts, backend automation, or direct-to-biller payments.

## Future Features

- Stablecoin support such as USDC or a PHP-pegged asset
- Soroban contracts for enforceable vault rules
- Scheduled releases
- Sender approval for withdrawals
- Direct-to-biller payments
- Recurring monthly remittances
- Receipt uploads
- Wallet login through Freighter
- Cash-out partner flow
- SMS or mobile notifications
- Family member roles
- Mainnet deployment
