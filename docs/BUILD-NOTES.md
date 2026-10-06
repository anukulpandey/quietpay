# QuietPay build — 5 October 2026

QuietPay is an Avalanche Fuji application for private team payments. Its single workspace provides wallet connection, deployment, registration, encrypted balances, reviewed payments, recipient receipts, and designated auditor access. The interface uses the Avalanche red and dark visual theme.

## Implementation

- Official eERC SDK 1.0.2 and a pinned, bundled eight-contract suite with matching proof files.
- Injected Core / MetaMask wallets; Fuji chain 43113 is required for transactions.
- Contract runtime and proof-file integrity checks before private payment tools activate.
- Single and sequential multi-recipient payments with confirmation checks and replacement recovery.
- Decryption keys and plaintext payment drafts remain in memory. Public deployment and encrypted transaction journals support safe recovery after reload.
- Wallet-based recipient and auditor access. The owner configures the auditor and mints QTEST test tokens.

## Validation and remaining acceptance

See [BLOCKCHAIN-INTEGRATION.md](./BLOCKCHAIN-INTEGRATION.md) for the real-proof integration evidence and [README](../README.md) for reproducible commands.

Public Fuji deployment requires a funded browser wallet and its approvals. No public deployment address or transaction hash is claimed. Fuji AVAX and QTEST have no real value; mainnet deployment is outside this build’s scope.
