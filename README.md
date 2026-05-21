# PadalaSplit

Purpose-based Stellar remittances for OFWs and Filipino families.

## Overview

PadalaSplit is a Stellar-powered remittance web app designed for Overseas Filipino Workers who send money home to their families in the Philippines.

Many OFWs send one lump-sum remittance that is later divided manually for groceries, tuition, bills, savings, emergency needs, and other household expenses. This can make it difficult for the sender and recipient to track how the money is intended to be used.

PadalaSplit helps make remittances clearer by allowing the sender to split one remittance into labeled family budget buckets before sending.

## Problem Statement

OFWs regularly support their families through remittances, but the money is often managed manually after it is received. Families may need to divide one payment across multiple needs, which can lead to confusion, overspending, or lack of visibility for the sender.

There is a need for a simple remittance tool that helps OFWs send money with clear purpose-based allocation while giving families transparent records of what each portion of the remittance is intended for.

## Proposed Solution

PadalaSplit lets an OFW enter a total remittance amount and allocate it across labeled buckets such as:

- Groceries
- Tuition
- Bills
- Savings
- Emergency funds

For the MVP, the app will use Stellar Testnet and XLM to demonstrate the full split-remittance flow. Each bucket is represented by a separate Stellar payment transaction with a memo identifying its purpose.

The recipient dashboard will show how much was received for each purpose, along with transaction hashes and Stellar explorer links as proof of payment.

## Target Users

Primary users:

- Overseas Filipino Workers sending money home
- Filipino family members receiving and managing remittances

Secondary users:

- Students
- Parents and guardians
- Household budget managers

## Stellar Integration

PadalaSplit uses Stellar as the payment and transaction verification layer.

For example, a 100 XLM remittance may be split into:

- 40 XLM for groceries
- 30 XLM for tuition
- 20 XLM for bills
- 10 XLM for emergency savings

The app will submit separate Stellar Testnet payment transactions for each bucket. Each transaction will include a memo label and will be saved with its transaction hash. Users can open a Stellar Expert link to verify each payment on-chain.

Future versions may support stablecoins, PHP-pegged assets, wallet integrations, and Soroban-based allocation rules.

## MVP Scope

The first version will focus on:

- Sender dashboard
- Create-remittance form
- Recipient wallet address input
- Total amount and bucket allocation inputs
- Automatic bucket amount calculation
- Multiple Stellar Testnet payments
- Transaction history with hashes and explorer links
- Recipient dashboard grouped by budget bucket

Data for the MVP may be stored using local storage or a lightweight database.

## Focus Track

Payments & Remittances

## Team

- Yuan Rubio - Project Lead / Full-stack Developer
- Rex Jumawid - Stellar Integration / Backend Developer

## Current Status

This repository is in early setup. The README, contributor guidance, and initial project workflow are being prepared before the application scaffold is added.

## Repository

GitHub repository link will be added before the next checkpoint.
