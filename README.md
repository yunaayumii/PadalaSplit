# PadalaSplit

Purpose-based Stellar remittances for OFWs and Filipino families.

## GitHub Repository Link

Repository link will be added before the next checkpoint.

## Problem Statement

Overseas Filipino Workers regularly send money home to support their families in the Philippines, but the money is often managed manually after it is received. Families may need to divide one remittance across groceries, bills, tuition, savings, and emergency needs, which can lead to confusion, overspending, or lack of visibility for the sender.

There is a need for a simple remittance tool that helps OFWs send money with clear purpose-based allocation while giving families transparent records of what each portion of the remittance is intended for.

## Proposed Solution

PadalaSplit is a Stellar-powered remittance web app that lets OFWs send money home and automatically split the remittance into labeled family budget buckets such as groceries, tuition, bills, savings, and emergency funds.

Instead of sending one untracked amount, the sender enters a total amount and chooses how it should be allocated. The app then sends separate Stellar payments to the recipient wallet for each bucket, using transaction memos to label the purpose of each payment.

The recipient dashboard shows how much was received for each purpose, along with transaction hashes and Stellar explorer links as proof of payment.

For the MVP, PadalaSplit will use Stellar Testnet and XLM to demonstrate the full split-remittance flow.

## Target Users / Audience

Primary users:

- Overseas Filipino Workers who send money home to their families
- Filipino family members who receive and manage remittances for household needs

Secondary users:

- Students
- Parents and guardians
- Household budget managers who need clearer visibility on remittance allocation

## Selected Focus Track

Payments & Remittances

## Team Members

- Yuan Rubio - Project Lead / Full-stack Developer
- Rex Jumawid - Stellar Integration / Backend Developer

## Initial Technical Approach

PadalaSplit will be built as a web-based MVP using a modern frontend framework such as React, Next.js, or Vite. The app will include:

- Sender dashboard
- Create-remittance form
- Recipient dashboard
- Transaction history view

The sender will enter the recipient Stellar wallet address, total remittance amount, and allocation percentages for each bucket. The app will calculate the amount for each bucket and submit multiple Stellar Testnet payment transactions, each with a unique memo or label.

For the MVP, data such as recipient profiles, remittance records, bucket allocations, and transaction hashes may be stored using local storage or a lightweight database. The app will display transaction status and provide links to Stellar Expert for transaction verification.

## Expected Stellar Integration

PadalaSplit will use Stellar as the payment and transaction verification layer. The MVP will use Stellar Testnet to send XLM from a sender wallet to a recipient wallet.

Each remittance bucket will be represented by a separate Stellar payment transaction. For example, a 100 XLM remittance may be split into:

- 40 XLM for groceries
- 30 XLM for tuition
- 20 XLM for bills
- 10 XLM for emergency savings

Each payment will include a memo identifying the bucket or purpose. The app will save and display the Stellar transaction hash for each bucket and link it to Stellar Expert, allowing both sender and recipient to verify the payment on-chain.

Future versions may support stablecoins, PHP-pegged assets, wallet integrations, and Soroban-based allocation rules.

## XLM Mainnet Wallet Address

To be provided by the team representative after creating and securing a Stellar Mainnet wallet.

## Current Status

This repository is in early setup. The project README, contributor guidance, and hackathon reference context have been prepared. Application scaffolding and Stellar Testnet integration are not yet implemented.
