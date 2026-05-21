#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env,
    Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BucketSpec {
    pub bucket_id: BytesN<32>,
    pub amount: i128,
    pub unlock_time: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bucket {
    pub sender: Address,
    pub recipient: Address,
    pub amount: i128,
    pub unlock_time: u64,
    pub claimed: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Remittance {
    pub sender: Address,
    pub recipient: Address,
    pub total_amount: i128,
    pub bucket_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Initialized,
    Token,
    Remittance(BytesN<32>),
    Bucket(BytesN<32>, BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    EmptyBuckets = 3,
    InvalidAmount = 4,
    DuplicateBucket = 5,
    RemittanceExists = 6,
    MissingBucket = 7,
    NotRecipient = 8,
    StillLocked = 9,
    AlreadyClaimed = 10,
}

#[contract]
pub struct PadalaSplitVault;

#[contractimpl]
impl PadalaSplitVault {
    pub fn init(env: Env, admin: Address, token: Address) -> Result<(), VaultError> {
        admin.require_auth();

        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(VaultError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.events().publish((symbol_short!("init"), admin), token);
        Ok(())
    }

    pub fn create_remittance(
        env: Env,
        sender: Address,
        recipient: Address,
        remittance_id: BytesN<32>,
        buckets: Vec<BucketSpec>,
    ) -> Result<(), VaultError> {
        sender.require_auth();
        ensure_initialized(&env)?;

        if buckets.is_empty() {
            return Err(VaultError::EmptyBuckets);
        }

        let remittance_key = DataKey::Remittance(remittance_id.clone());
        if env.storage().persistent().has(&remittance_key) {
            return Err(VaultError::RemittanceExists);
        }

        let mut total_amount = 0_i128;

        for spec in buckets.iter() {
            if spec.amount <= 0 {
                return Err(VaultError::InvalidAmount);
            }

            let bucket_key = DataKey::Bucket(remittance_id.clone(), spec.bucket_id.clone());
            if env.storage().persistent().has(&bucket_key) {
                return Err(VaultError::DuplicateBucket);
            }

            total_amount += spec.amount;
            env.storage().persistent().set(
                &bucket_key,
                &Bucket {
                    sender: sender.clone(),
                    recipient: recipient.clone(),
                    amount: spec.amount,
                    unlock_time: spec.unlock_time,
                    claimed: false,
                },
            );
        }

        env.storage().persistent().set(
            &remittance_key,
            &Remittance {
                sender: sender.clone(),
                recipient: recipient.clone(),
                total_amount,
                bucket_count: buckets.len(),
            },
        );

        let token_id = get_token(&env)?;
        let token_client = token::Client::new(&env, &token_id);
        token_client.transfer(&sender, &env.current_contract_address(), &total_amount);

        env.events().publish(
            (symbol_short!("created"), remittance_id, sender, recipient),
            total_amount,
        );
        Ok(())
    }

    pub fn withdraw(
        env: Env,
        recipient: Address,
        remittance_id: BytesN<32>,
        bucket_id: BytesN<32>,
    ) -> Result<(), VaultError> {
        recipient.require_auth();
        ensure_initialized(&env)?;

        let bucket_key = DataKey::Bucket(remittance_id.clone(), bucket_id.clone());
        let mut bucket = get_bucket_by_key(&env, &bucket_key)?;

        if bucket.recipient != recipient {
            return Err(VaultError::NotRecipient);
        }

        if bucket.claimed {
            return Err(VaultError::AlreadyClaimed);
        }

        if env.ledger().timestamp() < bucket.unlock_time {
            return Err(VaultError::StillLocked);
        }

        bucket.claimed = true;
        env.storage().persistent().set(&bucket_key, &bucket);

        let token_id = get_token(&env)?;
        let token_client = token::Client::new(&env, &token_id);
        token_client.transfer(
            &env.current_contract_address(),
            &recipient,
            &bucket.amount,
        );

        env.events().publish(
            (symbol_short!("withdraw"), remittance_id, bucket_id, recipient),
            bucket.amount,
        );
        Ok(())
    }

    pub fn get_remittance(
        env: Env,
        remittance_id: BytesN<32>,
    ) -> Result<Remittance, VaultError> {
        ensure_initialized(&env)?;
        env.storage()
            .persistent()
            .get(&DataKey::Remittance(remittance_id))
            .ok_or(VaultError::MissingBucket)
    }

    pub fn get_bucket(
        env: Env,
        remittance_id: BytesN<32>,
        bucket_id: BytesN<32>,
    ) -> Result<Bucket, VaultError> {
        ensure_initialized(&env)?;
        get_bucket_by_key(&env, &DataKey::Bucket(remittance_id, bucket_id))
    }

    pub fn is_withdrawable(
        env: Env,
        remittance_id: BytesN<32>,
        bucket_id: BytesN<32>,
    ) -> Result<bool, VaultError> {
        ensure_initialized(&env)?;
        let bucket = get_bucket_by_key(&env, &DataKey::Bucket(remittance_id, bucket_id))?;
        Ok(!bucket.claimed && env.ledger().timestamp() >= bucket.unlock_time)
    }
}

fn ensure_initialized(env: &Env) -> Result<(), VaultError> {
    if !env.storage().instance().has(&DataKey::Initialized) {
        return Err(VaultError::NotInitialized);
    }
    Ok(())
}

fn get_token(env: &Env) -> Result<Address, VaultError> {
    env.storage()
        .instance()
        .get(&DataKey::Token)
        .ok_or(VaultError::NotInitialized)
}

fn get_bucket_by_key(env: &Env, bucket_key: &DataKey) -> Result<Bucket, VaultError> {
    env.storage()
        .persistent()
        .get(bucket_key)
        .ok_or(VaultError::MissingBucket)
}

#[cfg(test)]
mod test {
    extern crate std;

    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::token::{StellarAssetClient, TokenClient};
    use soroban_sdk::{vec, Env};

    fn setup() -> (
        Env,
        Address,
        Address,
        Address,
        Address,
        BytesN<32>,
        BytesN<32>,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|ledger| {
            ledger.timestamp = 1_700_000_000;
        });

        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let token_id = sac.address();
        let token_admin = StellarAssetClient::new(&env, &token_id);
        token_admin.mint(&sender, &1_000_000_000);

        let contract_id = env.register(PadalaSplitVault, ());
        let client = PadalaSplitVaultClient::new(&env, &contract_id);
        client.init(&admin, &token_id);
        let remittance_id = BytesN::from_array(&env, &[1_u8; 32]);
        let bucket_id = BytesN::from_array(&env, &[2_u8; 32]);

        (
            env,
            contract_id,
            token_id,
            sender,
            recipient,
            remittance_id,
            bucket_id,
        )
    }

    #[test]
    fn creates_remittance_and_locks_funds() {
        let (env, contract_id, token_id, sender, recipient, remittance_id, bucket_id) = setup();
        let client = PadalaSplitVaultClient::new(&env, &contract_id);
        let token = TokenClient::new(&env, &token_id);

        client.create_remittance(
            &sender,
            &recipient,
            &remittance_id,
            &vec![
                &env,
                BucketSpec {
                    bucket_id: bucket_id.clone(),
                    amount: 100,
                    unlock_time: 1_700_000_060,
                },
            ],
        );

        assert_eq!(token.balance(&sender), 999_999_900);
        assert_eq!(token.balance(&contract_id), 100);

        let bucket = client.get_bucket(&remittance_id, &bucket_id);
        assert_eq!(bucket.amount, 100);
        assert_eq!(bucket.claimed, false);
    }

    #[test]
    fn rejects_zero_amount() {
        let (env, contract_id, _token_id, sender, recipient, remittance_id, bucket_id) = setup();
        let client = PadalaSplitVaultClient::new(&env, &contract_id);

        let result = client.try_create_remittance(
            &sender,
            &recipient,
            &remittance_id,
            &vec![
                &env,
                BucketSpec {
                    bucket_id,
                    amount: 0,
                    unlock_time: 1_700_000_060,
                },
            ],
        );

        assert_eq!(result, Err(Ok(VaultError::InvalidAmount)));
    }

    #[test]
    fn rejects_duplicate_bucket_ids() {
        let (env, contract_id, _token_id, sender, recipient, remittance_id, bucket_id) = setup();
        let client = PadalaSplitVaultClient::new(&env, &contract_id);

        let result = client.try_create_remittance(
            &sender,
            &recipient,
            &remittance_id,
            &vec![
                &env,
                BucketSpec {
                    bucket_id: bucket_id.clone(),
                    amount: 100,
                    unlock_time: 1_700_000_060,
                },
                BucketSpec {
                    bucket_id,
                    amount: 200,
                    unlock_time: 1_700_000_060,
                },
            ],
        );

        assert_eq!(result, Err(Ok(VaultError::DuplicateBucket)));
    }

    #[test]
    fn rejects_withdraw_before_unlock() {
        let (env, contract_id, _token_id, sender, recipient, remittance_id, bucket_id) = setup();
        let client = PadalaSplitVaultClient::new(&env, &contract_id);
        client.create_remittance(
            &sender,
            &recipient,
            &remittance_id,
            &vec![
                &env,
                BucketSpec {
                    bucket_id: bucket_id.clone(),
                    amount: 100,
                    unlock_time: 1_700_000_060,
                },
            ],
        );

        let result = client.try_withdraw(&recipient, &remittance_id, &bucket_id);
        assert_eq!(result, Err(Ok(VaultError::StillLocked)));
    }

    #[test]
    fn withdraws_after_unlock_and_rejects_double_withdrawal() {
        let (env, contract_id, token_id, sender, recipient, remittance_id, bucket_id) = setup();
        let client = PadalaSplitVaultClient::new(&env, &contract_id);
        let token = TokenClient::new(&env, &token_id);
        client.create_remittance(
            &sender,
            &recipient,
            &remittance_id,
            &vec![
                &env,
                BucketSpec {
                    bucket_id: bucket_id.clone(),
                    amount: 100,
                    unlock_time: 1_700_000_060,
                },
            ],
        );

        env.ledger().with_mut(|ledger| {
            ledger.timestamp = 1_700_000_061;
        });

        client.withdraw(&recipient, &remittance_id, &bucket_id);
        assert_eq!(token.balance(&recipient), 100);

        let result = client.try_withdraw(&recipient, &remittance_id, &bucket_id);
        assert_eq!(result, Err(Ok(VaultError::AlreadyClaimed)));
    }

    #[test]
    fn rejects_non_recipient_withdrawal() {
        let (env, contract_id, _token_id, sender, recipient, remittance_id, bucket_id) = setup();
        let client = PadalaSplitVaultClient::new(&env, &contract_id);
        let stranger = Address::generate(&env);
        client.create_remittance(
            &sender,
            &recipient,
            &remittance_id,
            &vec![
                &env,
                BucketSpec {
                    bucket_id: bucket_id.clone(),
                    amount: 100,
                    unlock_time: 1_700_000_000,
                },
            ],
        );

        let result = client.try_withdraw(&stranger, &remittance_id, &bucket_id);
        assert_eq!(result, Err(Ok(VaultError::NotRecipient)));
    }
}
