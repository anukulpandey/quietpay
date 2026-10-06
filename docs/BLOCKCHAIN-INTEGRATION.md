# Blockchain integration — 2026-10-05

The user asked to complete the real Avalanche integration. The implementation extends the existing standalone eERC design, retaining the official SDK and Avalanche Fuji only. The Fuji workspace is the only application flow and includes all official deployment/proving artifacts.

## Acceptance evidence

- Real local EVM integration: official eight-contract deployment, bytecode verification, three Groth16 registration proofs, owner auditor configuration, private mint, encrypted transfer, sender/recipient balance checks, auditor amount decryption, recipient/mint receipt decryption, repeat signature key derivation.
- Unit coverage: exact amounts, duplicate/self/zero recipients, insufficient funds, batch pause/retry, confirmed-row skipping, bytecode linking and immutable normalization, original/replacement transaction classification.
- Public Fuji JSON-RPC returned chain ID 0xa869 and a current block. Browser also displays a live Fuji block.
- Browser acceptance passed: proof hash verification, all contract runtimes, three registration proofs, mint, transfer, both balances and incoming receipt decryption on an isolated localhost EVM.
- Public Fuji deployment remains pending the user's funded wallet. No public deployment or public transfer hash is claimed.

## Implementation choices

Official source and production proof files are pinned to Ava Labs EncryptedERC commit 8dc98cd4d63ad3aa6d86b70b8f4bbcd70f1e8be1. The app compiles and verifies the entire deployment graph and checks proof hashes before enabling the SDK. The deployer uses an injected wallet; the application never generates or collects the user's private key.

Live runs stay in memory to avoid plaintext payroll persistence. Only encrypted calldata and public transaction metadata are journaled. The exact nonce and payload are captured before wallet submission so post-reload speed-ups/cancellations can be verified against the original intent. A confirmed replacement with different calldata cannot count as payment.

Post-confirmation balances use a fresh RPC block number with the confirmed receipt block as a minimum; cached block heights must not produce the next transfer's proof. Each transfer rechecks account, chain, current balance, recipient registration and auditor. Batch execution is sequential and stops on error.

## Final wallet acceptance

Connect a funded wallet in Chrome/Core/MetaMask, deploy and activate the contracts, register owner/auditor/recipient accounts, designate auditor, mint QTEST, pay a run and verify recipient/auditor views. This is the remaining public testnet acceptance step, not a missing code configuration exercise.
