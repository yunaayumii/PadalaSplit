# Soroban Vault Setup

PadalaSplit can enforce locked buckets with the `padalasplit_vault` Soroban contract.

## Prerequisites

Install Rust, the WASM target, and Stellar CLI:

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
```

Add Testnet if your Stellar CLI does not already have it:

```bash
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  --global
```

Create or import a funded Testnet identity:

```bash
stellar keys generate --global padalasplit-deployer --network testnet
stellar keys fund padalasplit-deployer --network testnet
```

## Build And Deploy

Build the contract:

```bash
stellar contract build
```

Deploy the native XLM Stellar Asset Contract if needed and save the contract ID:

```bash
stellar contract asset deploy \
  --asset native \
  --source padalasplit-deployer \
  --network testnet
```

Deploy the vault:

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/padalasplit_vault.wasm \
  --source padalasplit-deployer \
  --network testnet \
  --alias padalasplit_vault_testnet
```

Initialize the vault with the deployer address and native XLM token contract ID:

```bash
stellar contract invoke \
  --id padalasplit_vault_testnet \
  --source padalasplit-deployer \
  --network testnet \
  -- \
  init \
  --admin "$(stellar keys address padalasplit-deployer)" \
  --token "<XLM_TOKEN_CONTRACT_ID>"
```

## Frontend Environment

Add these values to `.env.local`:

```env
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_PADALASPLIT_VAULT_CONTRACT_ID=<VAULT_CONTRACT_ID>
```

Restart Vite after changing environment variables:

```bash
npm run dev
```

When `VITE_PADALASPLIT_VAULT_CONTRACT_ID` is set, the app changes the payment action from direct Stellar payments to `Create Vault`.

## Demo Flow

1. Connect the sender wallet in Freighter on Testnet.
2. Create a remittance preview.
3. Click `Create Vault` to deposit all bucket funds into the vault contract.
4. Connect the recipient wallet in Freighter.
5. Withdraw each bucket after its unlock timestamp.

The contract enforces recipient-only withdrawals and rejects early or duplicate withdrawals.
