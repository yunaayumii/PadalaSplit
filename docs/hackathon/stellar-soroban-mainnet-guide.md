# Stellar Soroban Mainnet Deployment Guide Reference

Source:

- https://github.com/armlynobinguar/Stellar-Hackathon-PH-2026/blob/main/Guide.md

This file intentionally stores a short local summary instead of copying the full external guide into this repository.

## Summary

The referenced guide explains how to deploy production-ready Soroban smart contracts to the Stellar Public Network. It covers:

- Installing Rust and the Stellar CLI
- Adding the `wasm32v1-none` target
- Configuring Stellar Mainnet RPC
- Setting up deployer identities
- Building, uploading, and deploying Soroban contracts
- Invoking deployed contracts
- Extending contract and WASM TTL
- Deploying Stellar Asset Contracts
- Verifying contracts on Stellar Expert
- Estimating deployment fees
- Applying mainnet security practices
- Troubleshooting common deployment errors

## PadalaSplit Interpretation

PadalaSplit should use Stellar Testnet and XLM for the MVP unless the hackathon explicitly requires Mainnet deployment.

Treat the mainnet guide as deployment-readiness context only. Do not use real funds, mainnet deployer keys, or production credentials during normal MVP development.

## Security Reminder

Never commit seed phrases, secret keys, API tokens, funded wallet credentials, or populated `.env` files.
