# QuietPay — Avalanche-only product specification

## Product

Private team payments on Avalanche Fuji using official standalone eERC contracts. The app has one wallet-backed workspace with an Avalanche Builder Hub-inspired dark and red interface.

## Workflow

Connect a wallet on Fuji, deploy or join the verified contract suite, register each wallet, unlock private balances, set the designated auditor, and mint QTEST using the owner wallet. Review single or multi-recipient payments and approve transactions individually. Recipients read their own receipts; the designated auditor decrypts recent activity.

## Data and access

Balances, registration, payments, and receipts come from the contract on chain 43113. Keys and plaintext payment drafts remain in memory. Public deployment metadata and encrypted transaction intents may be persisted for recovery. Never treat a changed replacement transaction as a successful payment. Never automatically resend an uncertain submission.

Wallet addresses and timing remain public. The designated auditor can decrypt amounts within their scope. QTEST and Fuji AVAX are test assets with no real value.

## Acceptance

The app builds and renders on desktop and mobile. Official contract deployment, proof generation, private transfer, balance reads and receipt decryption are verified on a local EVM. The final public Fuji acceptance requires a funded browser wallet and transaction approvals. Report local validation and public deployment separately.
