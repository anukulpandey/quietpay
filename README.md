# QuietPay

**Live app:** [quietpay.vercel.app](https://quietpay.vercel.app)

Private team payments using the official Avalanche EncryptedERC contracts and SDK. The app runs exclusively in its **on-chain Avalanche Fuji workspace**. Wallet connection, contracts, balances, payments, receipts, and auditor access all use the Fuji integration.

## What is integrated

- Core / MetaMask / injected wallet connection, Fuji network switching, live block number and test AVAX gas balance.
- Browser deployment of the official eight-contract standalone eERC suite. Wallet signs each deployment; progress resumes after refresh. No private key is collected by the app.
- Contract runtime verification and SHA-256 checks of the bundled, matching proof files before private payment tools activate.
- Wallet registration, signature-derived keys in memory, encrypted balance decryption, owner auditor setup and QTEST minting.
- Reviewed single and multi-recipient encrypted payments with fresh balance reads, individual confirmed receipts, pause-on-error, and no resending confirmed rows.
- Recovery of original or replacement transactions using persisted sender, nonce and encrypted calldata. A successful cancellation or changed call never counts as a payment.
- Recipient mint/payment receipts read from Fuji events and decrypted locally. Outgoing historical amounts remain labeled encrypted; current-session payment-run receipts show their reviewed amounts.
- Design inspired by Avalanche Builder Hub.

**Deployment status:** the complete contract + SDK flow has passed against an isolated local EVM configured with Fuji's chain ID. The public Avalanche Fuji RPC is reachable. **No QuietPay contract has been deployed to public Fuji from this workspace yet:** that final step requires your funded browser wallet and wallet approvals. A local EVM test is not a Fuji transaction.

## Run

Node 20.19+ (tested with 20.20.2):

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173` in Chrome or another browser with Core / MetaMask. The Codex in-app browser does not currently expose an installed wallet.

```sh
npm test              # 12 focused validation / confirmation / retry tests
npm run chain:prepare # compile the pinned official Solidity and hash bundled circuits
npm run test:chain    # actual local contracts + Groth16 proofs, ~30 seconds
npm run build        # TypeScript and production bundle, including proof files
node scripts/browser-node.mjs # isolated RPC for optional browser acceptance
```

For browser acceptance, start the isolated RPC above and open `/scripts/browser-smoke.html` on the Vite server. The test uses public fixture keys only on localhost, never public Fuji; stop that RPC when finished.

The chain integration test creates ephemeral local test accounts, deploys all eight contracts, verifies their runtime code, registers three wallets, configures an auditor, mints tokens, transfers privately, checks both balances, decrypts the auditor event and incoming receipts, and re-derives the recipient key. It does not access or spend funds from any personal wallet.

## Deploy and make your first Fuji payment

1. Open **On-chain payments** and connect a browser wallet. Switch to **Avalanche Fuji (43113)** when prompted.
2. Use **Get free Fuji test AVAX** to fund that wallet. There is no mainnet deployment flow.
3. The deployment wizard enables once connected on Fuji. Approve its eight contract deployments one by one. Each completed step is checked against the compiled runtime bytecode. If interrupted, reconnect the same wallet on the same origin and use **Check transaction**.
4. Select **Activate verified Fuji deployment**. The contract address is stored as public configuration for this browser; the page reloads into that workspace.
5. **Register for private payments**. Your wallet signs a key-derivation message, the browser generates the registration proof, then the wallet approves the on-chain registration.
6. Register the auditor wallet and each recipient wallet against the same token. On another browser, use **Join an existing QuietPay deployment**, paste the token contract address, and choose **Verify and join**. The app checks the full official contract suite before accepting it.
7. Back in the owner wallet, unlock and open **Test-token owner tools**. Set a registered auditor, then mint 10,000 QTEST to the owner. QTEST and Fuji AVAX are test assets with no real value. The auditor can be the owner for a quick test, or a separate registered wallet.
8. Review a single payment or add recipient wallets to an on-chain run. Approve each transaction in the wallet. Transfers are sequential, not atomic: a later failure does not undo earlier confirmed payments.
9. Connect a recipient to unlock its balance and **Refresh receipts**. Connect the designated auditor to decrypt recent activity.

## Website deployment

The frontend is hosted on Vercel at https://quietpay.vercel.app. `vercel.json` selects the Vite build and `dist` output; `.vercelignore` excludes local build artifacts, browser captures and environment files from CLI uploads. Bundled proof files and the deployment manifest are served from the same origin.

Hosting the frontend does not deploy the contracts. Connect a funded Fuji wallet to deploy a token, or join an existing verified deployment. Browser-saved deployment configuration and pending transaction records are specific to the site origin; localhost data does not automatically appear on the hosted site.

## Recovery and privacy

- No decryption keys, payroll amounts or live drafts are written to browser storage. Draft runs exist only for the current session. Do not close a run in progress; confirmed transactions remain recoverable from the chain even if the draft is lost.
- The public transaction journal stores kind, random payment row ID, hash, sender, destination, nonce, value and **encrypted/public calldata**. These fields let the app verify replacements after reload. Clear it only after reconciling the wallet activity.
- If a transaction is sped up or cancelled after closing the tab, paste the replacement hash into the pending-transaction form. Only the same sender and nonce can resolve the pending operation; only the same payload can count as the original operation.
- An unknown submission never triggers an automatic resend. If no hash was returned, inspect wallet activity; provide the transaction hash or explicitly confirm that nothing was submitted.
- Recipients and auditors unlock with their own wallets; access follows the connected wallet and the contract’s auditor configuration.
- eERC encrypts balances and transfer amounts; wallet addresses and timing remain public. The designated auditor can decrypt amounts in its scope.
- Wallet history is paginated in 1,000-block windows. Nested contract transfers can be listed without a decrypted per-payment amount; their value is reflected in the private balance. Auditor history currently covers the most recent 1,000 blocks.

## Sources and reproducibility

The official [Ava Labs EncryptedERC](https://github.com/ava-labs/EncryptedERC/tree/8dc98cd4d63ad3aa6d86b70b8f4bbcd70f1e8be1) revision is pinned in `vendor/encrypted-erc/UPSTREAM.json`. Solidity sources and the unmodified Ecosystem License are included there. Production verifier contracts come from `contracts/prod`. Matching `.wasm` and `.zkey` files from that revision's `circom/build` are in `public/circuits` with its license.

`chain:prepare` compiles with solc 0.8.27, optimizer 200 runs and Shanghai EVM, and emits ABI, creation bytecode, runtime bytecode, library link slots, immutable slots, and circuit hashes into `public/deployment/manifest.json`. All eight deployment artifacts and the proof files ship with the production build. `@avalabs/eerc-sdk` is pinned to 1.0.2.

A custom deployment can also be configured through `.env.local`; see `.env.example`. It must use the exact bundled contract/proof build. The browser importer rejects incompatible deployments.

Vite warns about the size of the lazily loaded crypto SDK and its conditional Node imports. Local real-proof tests pass. Browser proof generation, local-chain mint/transfer, and recipient receipt decryption also passed in the real browser. Wallet-driven public Fuji deployment still needs the funded wallet acceptance run described above. Mainnet use is outside this build's scope.
