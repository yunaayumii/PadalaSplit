# PadalaSplit Feature Plan

PadalaSplit is a purpose-based remittance app for OFWs and Filipino families. It helps senders split money by household purpose, gives recipients clear visibility, and reduces the risk that critical funds are spent all at once.

## Product Goal

Help OFWs send money home with structure and trust.

Instead of sending one lump sum that the family must manually manage, PadalaSplit divides a remittance into labeled buckets such as groceries, tuition, bills, savings, and emergency funds.

## Core MVP Features

These are the features to build first for a complete hackathon demo.

### 1. Create Remittance

The sender can create a new remittance by entering:

- Sender name
- Recipient name
- Recipient Stellar wallet address
- Total remittance amount
- Bucket names
- Bucket percentages or amounts

Example:

```text
Total: 100 XLM
Groceries: 40 XLM
Tuition: 30 XLM
Bills: 20 XLM
Emergency: 10 XLM
```

### 2. Bucket Split Calculator

The app automatically calculates how much money goes into each bucket.

Rules:

- Bucket totals must equal the full remittance amount.
- Percentages must total 100%.
- Fixed amounts must not exceed the remittance total.
- The sender should see a clear preview before confirming.

### 3. Stellar Testnet Split Payments

For the MVP, each bucket can be sent as a separate Stellar Testnet XLM payment to the recipient wallet.

Example:

```text
40 XLM -> recipient wallet, memo: groceries
30 XLM -> recipient wallet, memo: tuition
20 XLM -> recipient wallet, memo: bills
10 XLM -> recipient wallet, memo: emergency
```

Each payment should include:

- Destination wallet
- Amount
- Bucket label in the memo
- Transaction hash
- Stellar Expert Testnet link

### 4. Recipient Dashboard

The recipient can view the remittance organized by purpose.

Dashboard should show:

- Total received
- Amount per bucket
- Bucket status
- Sender name
- Date received
- Transaction history

### 5. Transaction Proof

Each bucket should show on-chain proof.

Show:

- Payment status
- Transaction hash
- Stellar Expert Testnet link
- Amount
- Bucket memo

This makes the Stellar integration visible to judges.

### 6. Demo Mode

Add a demo-friendly setup so the final presentation is smooth.

Demo mode can include:

- Prefilled sender name
- Prefilled recipient wallet
- Sample 100 XLM remittance
- Preset bucket split
- Sample family profile

### 7. Locked Bucket UI Simulation

Some buckets can be marked as locked.

Example:

```text
Tuition: locked until enrollment week
Emergency: locked unless sender approves
Savings: locked for 30 days
Groceries: available immediately
```

MVP version:

- Simulate locked status in the app UI.
- Show which funds are available and which are protected.

Future version:

- Use Soroban smart contracts to enforce locks on-chain.

## Protection Model

If funds are sent directly to the recipient wallet, PadalaSplit cannot enforce spending restrictions. The MVP shows locked buckets as product intent and UI status only.

Enforceable protection requires a future implementation using app-controlled vaults, Soroban smart contracts, backend automation, or direct-to-biller payments.

## Remittance Protection Features

These features address the concern that a recipient might withdraw all the money and misuse it.

### Scheduled Releases

Instead of making all funds available immediately, the sender can release money gradually.

Example:

```text
Groceries: 10 XLM released every week
Allowance: 5 XLM released every Monday
Bills: released on due date
```

MVP version:

- Show release schedule and next release date.
- Simulate available vs. locked amounts.

Future version:

- Use smart contracts or backend automation to release funds on schedule.

### Sender Approval for Withdrawals

Sensitive buckets can require sender approval before use.

Example:

```text
Recipient requests 20 XLM from Emergency Fund.
Sender receives request.
Sender approves or rejects.
```

MVP version:

- Recipient can create a withdrawal request.
- Sender dashboard shows pending requests.
- Approval updates app status.

Future version:

- Approval triggers actual contract-controlled fund release.

### Direct-to-Biller Payments

For important expenses, funds can be sent directly to a biller instead of the family wallet.

Examples:

```text
Tuition bucket -> school wallet
Rent bucket -> landlord wallet
Bills bucket -> utility provider wallet
Groceries bucket -> family wallet
```

This is the strongest real-world protection model because the money goes directly to the intended recipient.

MVP version:

- Allow bucket destination to be either family wallet or biller wallet.
- Demonstrate with sample school or utility wallet.

### Spending Confirmation

The recipient can mark a bucket as used and add a note.

Example:

```text
Tuition paid for June enrollment.
Electric bill paid.
Groceries purchased for the week.
```

Optional fields:

- Note
- Receipt image
- Date used

For MVP, text notes are enough.

## Recommended 8-Hour MVP Scope

Build only the features needed to tell a complete story:

1. Create remittance form
2. Bucket split calculator
3. Stellar Testnet split payments
4. Recipient dashboard
5. Transaction proof links
6. Locked bucket UI simulation
7. Demo mode

This is enough to show the core value:

```text
An OFW sends money once.
The app splits it by purpose.
Critical funds are labeled or protected.
The family sees the budget clearly.
Judges can verify the Stellar transactions on-chain.
```

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
