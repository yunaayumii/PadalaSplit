# 🚀 Stellar Soroban — Mainnet Deployment Guide

> Deploy production-ready Soroban smart contracts to the Stellar Public Network.

---

## ⚠️ Pre-Deployment Checklist

Before deploying to Mainnet:

- [ ] Contract fully tested on Testnet
- [ ] Security audit completed (for high-value contracts)
- [ ] Deployer account funded with real XLM
- [ ] Contract logic reviewed for TTL expiry handling
- [ ] Upgrade/admin keys secured and backed up
- [ ] RPC provider selected and configured

---

## 📋 Prerequisites

### 1. Install Rust

```bash
# macOS / Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Windows
# Download and run rustup-init.exe from https://rustup.rs
```

### 2. Add WASM Target

```bash
rustup target add wasm32v1-none
```

### 3. Install Stellar CLI

```bash
cargo install --locked stellar-cli
```

> **Note:** Older versions of this guide used `cargo install --locked stellar-cli --features opt`. If Cargo reports that `stellar-cli` does not contain the `opt` feature, use the command above instead.

### 4. Verify Installation

```bash
stellar --version
rustc --version
cargo --version
```

---

## 🌐 Network Configuration

### Add Mainnet (Manual — Required)

```bash
stellar network add mainnet \
  --rpc-url "https://mainnet.sorobanrpc.com" \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  --global
```

### Alternative RPC Providers

| Provider | RPC URL |
|----------|---------|
| SDF Default | `https://mainnet.sorobanrpc.com` |
| Validation Cloud | `https://stellar-mainnet.sorobanrpc.com` |
| Ankr | `https://rpc.ankr.com/stellar_soroban` |

> **Tip:** For production dApps, use a dedicated RPC node or a paid provider for reliability.

### Verify Networks

```bash
stellar network ls
```

---

## 🔑 Identity / Wallet Setup

### Option A — Import Existing Secret Key (Recommended for Mainnet)

```bash
# Add your funded mainnet keypair
stellar keys add mainnet-deployer --secret-key
# Paste your secret key when prompted
```

> 🔐 **Security:** Never use a generated key without first backing up the secret key. For Mainnet, use a hardware wallet or secure key management system where possible.

### Option B — Generate New Identity

```bash
stellar keys generate --global mainnet-deployer

# Get your public key (fund this with real XLM before deploying)
stellar keys address mainnet-deployer
```

> ⚠️ **Fund your account first!** Send at least 2–5 XLM to the address above before continuing. Deployment fees require a funded account.

### Check Balance

```bash
stellar account balance mainnet-deployer --network mainnet
```

---

## 🏗️ Build the Contract

```bash
# From project root
stellar contract build

# Output: target/wasm32v1-none/release/my_contract.wasm
```

> **Production tip:** Run `cargo test` before building to ensure all tests pass.

```bash
cargo test
```

---

## 📤 Step 1 — Upload WASM to Mainnet

```bash
stellar contract upload \
  --wasm target/wasm32v1-none/release/my_contract.wasm \
  --source mainnet-deployer \
  --network mainnet
```

**Output:** WASM hash (e.g., `7792a624b562b3d9414792f5fb5d72f53b9838fef2ed9a901471253970bc3b15`)

> Save this hash. You can redeploy multiple contract instances from the same WASM hash without re-uploading.

---

## 🚀 Step 2 — Deploy the Contract

### Option A — Deploy directly from WASM file

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/my_contract.wasm \
  --source mainnet-deployer \
  --network mainnet
```

### Option B — Deploy from uploaded WASM hash

```bash
stellar contract deploy \
  --wasm-hash <YOUR_WASM_HASH> \
  --source mainnet-deployer \
  --network mainnet
```

### With alias (recommended)

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/my_contract.wasm \
  --source mainnet-deployer \
  --network mainnet \
  --alias my_contract_mainnet
```

**Output:** Contract ID (e.g., `CACDYF3CYMJEJTIVFESQYZTN67GO2R5D5IUABTCUG3HXQSRXCSOROBAN`)

> 📌 **Save your Contract ID immediately.** You'll need it to invoke, upgrade, and extend the contract.

---

## 🔍 Step 3 — Invoke the Contract

```bash
stellar contract invoke \
  --id <CONTRACT_ID_OR_ALIAS> \
  --source mainnet-deployer \
  --network mainnet \
  -- \
  <function_name> \
  --arg_name arg_value
```

### Example — Token transfer

```bash
stellar contract invoke \
  --id my_contract_mainnet \
  --source mainnet-deployer \
  --network mainnet \
  -- \
  transfer \
  --from GABC... \
  --to GXYZ... \
  --amount 1000000
```

### Read-only query (no fee)

```bash
stellar contract invoke \
  --id my_contract_mainnet \
  --network mainnet \
  -- \
  balance \
  --address GABC...
```

---

## ⏳ Step 4 — Extend Contract TTL

> **Critical for Mainnet:** Contracts expire after ~30 days without extension. Extend TTL after deployment and periodically thereafter.

```bash
# Extend contract instance TTL (~1 year ≈ 535,000 ledgers)
stellar contract extend \
  --id my_contract_mainnet \
  --ledgers-to-extend 535000 \
  --source mainnet-deployer \
  --network mainnet

# Extend WASM bytecode TTL
stellar contract extend \
  --wasm-hash <YOUR_WASM_HASH> \
  --ledgers-to-extend 535000 \
  --source mainnet-deployer \
  --network mainnet
```

### Check TTL

```bash
stellar contract info instance \
  --id my_contract_mainnet \
  --network mainnet
```

---

## 🔄 Upgrade a Contract (If Upgradeable)

```bash
# 1. Build the new version
stellar contract build

# 2. Upload new WASM to Mainnet
stellar contract upload \
  --wasm target/wasm32v1-none/release/my_contract.wasm \
  --source mainnet-deployer \
  --network mainnet
# Save the new WASM hash

# 3. Invoke the upgrade function (must be implemented in contract)
stellar contract invoke \
  --id my_contract_mainnet \
  --source mainnet-deployer \
  --network mainnet \
  -- \
  upgrade \
  --new_wasm_hash <NEW_WASM_HASH>
```

---

## 🪙 Deploy a Stellar Asset Contract (SAC) on Mainnet

```bash
# Deploy SAC for an asset you've issued
stellar contract asset deploy \
  --asset "TOKEN:G<ISSUER_PUBLIC_KEY>" \
  --source mainnet-deployer \
  --network mainnet

# Get contract address for native XLM on Mainnet
stellar contract id asset \
  --network mainnet \
  --asset native
```

---

## 🌐 Verify on Explorer

```
https://stellar.expert/explorer/public/contract/<CONTRACT_ID>
```

Check transaction history, state entries, and contract details in real time.

---

## 📊 Quick Reference — Mainnet Commands

| Action | Command |
|--------|---------|
| Add mainnet network | `stellar network add mainnet --rpc-url https://mainnet.sorobanrpc.com ...` |
| Import deployer key | `stellar keys add mainnet-deployer --secret-key` |
| Check balance | `stellar account balance mainnet-deployer --network mainnet` |
| Build contract | `stellar contract build` |
| Upload WASM | `stellar contract upload --network mainnet` |
| Deploy contract | `stellar contract deploy --network mainnet` |
| Invoke function | `stellar contract invoke --network mainnet -- <fn>` |
| Extend TTL | `stellar contract extend --ledgers-to-extend 535000 --network mainnet` |
| Verify on explorer | `https://stellar.expert/explorer/public/contract/<ID>` |

---

## 🔑 Mainnet Network Details

| Parameter | Value |
|-----------|-------|
| Network Passphrase | `Public Global Stellar Network ; September 2015` |
| RPC URL | `https://mainnet.sorobanrpc.com` |
| Horizon URL | `https://horizon.stellar.org` |
| Explorer | `https://stellar.expert/explorer/public` |
| Friendbot | ❌ Not available (use real XLM) |

---

## 💸 Fee Estimation

Before deploying, simulate the transaction to estimate fees:

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/my_contract.wasm \
  --source mainnet-deployer \
  --network mainnet \
  --fee 1000000 \
  --build-only
```

> Typical deployment fees range from **0.01 to 0.5 XLM** depending on contract size.

---

## 🔐 Security Best Practices

| Practice | Details |
|----------|---------|
| Key management | Use hardware wallets or HSMs for deployer keys |
| Admin separation | Use a multisig or separate admin key from deployer |
| TTL automation | Set up a bot or cron job to extend TTL before expiry |
| Audit before deploy | Always audit contracts handling user funds |
| Immutability | If no upgrade function, contract is immutable — verify thoroughly |
| Test on Testnet first | Mirror your Mainnet setup on Testnet before going live |

---

## ⚠️ Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `insufficient balance` | Fund your deployer account with real XLM |
| `network not found: mainnet` | Run `stellar network add mainnet ...` first |
| `contract not found` | Contract TTL expired; restore using `stellar contract restore` |
| `WDAC policy blocks` (Windows) | Run as Administrator or use WSL2 |
| `reference-types WASM error` | Ensure Soroban SDK version matches CLI version |
| `tx_bad_auth` | Wrong signing key for the operation |

### Restore an Expired Contract

```bash
stellar contract restore \
  --id my_contract_mainnet \
  --source mainnet-deployer \
  --network mainnet
```

---

> 🚨 **Mainnet is permanent.** Mistakes cannot be undone. Always test on Testnet first and double-check all contract logic, admin keys, and upgrade paths before deploying.
