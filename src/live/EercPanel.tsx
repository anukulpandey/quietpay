import { useEffect, useRef, useState } from 'react';
import { formatUnits, type Address, type Hash, type WalletClient } from 'viem';
import { ArrowRight, Check, ExternalLink, KeyRound, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Modal } from '../components/Modal';
import { validAddress } from '../lib/address';
import { parseLiveAmount } from './amount';
import { createSession, publicClient, readAuditor, readPrivateBalance, readRecentAudit, type LiveSession } from './session';
import { liveConfig } from './config';
import LiveBatch from './LiveBatch';
import WalletHistory from './WalletHistory';
import { executeLiveBatch, validateBatch, type LivePayment } from './batch';
import { confirmationOutcome, recoveredOutcome, serializeAudit, type TransactionIntent, type ReplacementReason } from './transactions';

type Pending = { intent?: TransactionIntent; kind: string; paymentId?: string; hash?: Hash; replacementReason?: ReplacementReason };
type Review = { to: Address; amount: bigint; displayAmount: string };

export default function EercPanel({ wallet, address }: { wallet: WalletClient; address: Address }) {
  const [batch, setBatch] = useState<LivePayment[]>([]);
  const pendingRef = useRef<Pending | undefined>(undefined);
  const confirmedBlock = useRef(0n);
  const [replacementHash, setReplacementHash] = useState('');
  const [session, setSession] = useState<LiveSession>();
  const [registered, setRegistered] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [balance, setBalance] = useState<bigint>();
  const [busy, setBusy] = useState('');
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [hash, setHash] = useState<Hash>();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [review, setReview] = useState<Review>();
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof readRecentAudit>>>();
  const [auditorAddress, setAuditorAddress] = useState('');
  const pendingKey = `quietpay.pending.43113.${liveConfig.address}.${address.toLowerCase()}`;
  const [pending, setPending] = useState<Pending>();
  const [manualCheck, setManualCheck] = useState(false);
  const [retryInit, setRetryInit] = useState(0);

  useEffect(() => {
    let active = true;
    setError(''); setSession(undefined); setBalance(undefined); setUnlocked(false); setRegistered(false);
    createSession(wallet, intent => { if (!pendingRef.current) throw new Error('No active transaction journal.'); journal({ ...pendingRef.current, intent }); }).then(async (value) => {
      const key = await value.sdk.fetchPublicKey(address);
      if (active) { setSession(value); setRegistered(key[0] !== 0n && key[1] !== 0n); }
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not initialize encrypted payments.'); });
    return () => { active = false; };
  }, [wallet, address, retryInit]);

  useEffect(() => {
    function refreshPending() {
      try { const raw = localStorage.getItem(pendingKey); const value = raw ? JSON.parse(raw) : undefined; pendingRef.current = value; setPending(value); }
      catch { setPending({ kind: 'Unresolved operation' }); setError('Cannot read the transaction journal. Check browser storage before sending.'); }
    }
    refreshPending(); window.addEventListener('storage', refreshPending);
    return () => window.removeEventListener('storage', refreshPending);
  }, [pendingKey]);

  async function action(label: string, operation: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(label); setError(''); setMessage('');
    try { if (await wallet.getChainId() !== 43113) throw new Error('Switch back to Avalanche Fuji.'); await operation(); }
    catch (e) { setError(e instanceof Error ? e.message.split('\n').slice(0, 3).join(' ') : 'Operation failed. Check your wallet and network.'); }
    finally { inFlight.current = false; setBusy(''); }
  }
  function journal(value?: Pending) {
    // The journal stores only public transaction metadata, never payroll amounts or keys.
    if (value) localStorage.setItem(pendingKey, JSON.stringify(value)); else localStorage.removeItem(pendingKey);
    pendingRef.current = value; setPending(value);
  }
  async function transaction(kind: string, send: () => Promise<string>, paymentId?: string) {
    if (!navigator.locks) throw new Error('A browser with Web Locks is required to prevent simultaneous payment submissions.');
    return await navigator.locks.request(pendingKey, { ifAvailable: true }, async (lock) => {
      if (!lock) throw new Error('Another tab is already submitting from this wallet.');
      if (localStorage.getItem(pendingKey)) throw new Error('Reconcile the previous transaction before submitting another.');
      journal({ kind, paymentId });
      let transactionHash: string;
      try { transactionHash = await send(); }
      catch (e) {
        // Only explicit wallet rejection proves that no transaction was submitted here.
        let cause: unknown = e;
        for (let depth = 0; depth < 8 && cause && typeof cause === 'object'; depth++) {
          const typed = cause as { code?: number; cause?: unknown };
          if (typed.code === 4001) { journal(); break; }
          cause = typed.cause;
        }
        throw e;
      }
      if (!transactionHash) { journal(); return; }
      if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) throw new Error('Unexpected transaction response. Inspect your wallet before continuing.');
      const tx = transactionHash as Hash;
      setHash(tx); journal({ ...pendingRef.current, kind, paymentId, hash: tx });
      let replacementReason: ReplacementReason | undefined;
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx, timeout: 120_000, onReplaced: (replacement) => {
        replacementReason = replacement.reason;
        setHash(replacement.transaction.hash);
        journal({ ...pendingRef.current, kind, paymentId, hash: replacement.transaction.hash, replacementReason });
      } });
      const actual = await publicClient.getTransaction({ hash: receipt.transactionHash });
      const outcome = pendingRef.current?.intent ? recoveredOutcome(pendingRef.current.intent, actual, receipt.status) : confirmationOutcome(receipt.status, replacementReason);
      setHash(receipt.transactionHash);
      confirmedBlock.current = receipt.blockNumber;
      journal();
      if (outcome !== 'confirmed') throw new Error(`The original transaction was ${outcome}. It is not marked complete. Inspect the final transaction before sending again.`);
      setMessage(`${kind} confirmed on Avalanche Fuji.`);
      return receipt.transactionHash;
    });
  }
  async function refreshBalance() {
    if (!session || !session.sdk.isDecryptionKeySet) return;
    const value = await readPrivateBalance(session, address, confirmedBlock.current);
    setBalance(value.decrypted);
  }
  async function unlock() {
    if (!session) return;
    await session.sdk.generateDecryptionKey();
    const onchainKey = await session.sdk.fetchPublicKey(address);
    if (onchainKey[0] !== session.sdk.publicKey[0] || onchainKey[1] !== session.sdk.publicKey[1]) throw new Error('This wallet signature does not match the registered encryption key. Do not send funds until the key mismatch is resolved.');
    setUnlocked(true); await refreshBalance();
    setMessage('Private balance unlocked for this session. Your decryption key stays in memory.');
  }
  async function sendReviewedPayment(to: Address, units: bigint, paymentId?: string) {
    if (!session) throw new Error('Unlock your wallet first.');
    if (await wallet.getChainId() !== 43113) throw new Error('Switch to Avalanche Fuji.');
    const accounts = await wallet.getAddresses();
    if (accounts[0]?.toLowerCase() !== address.toLowerCase()) throw new Error('Wallet account changed. Reconnect before sending.');
    const targetKey = await session.sdk.fetchPublicKey(to);
    if (targetKey.some(part => part === 0n)) throw new Error(`Recipient ${to} must register for private payments first.`);
    const current = await readPrivateBalance(session, address, confirmedBlock.current);
    if (current.decrypted < units) throw new Error('Insufficient encrypted token balance.');
    const auditor = await readAuditor(session);
    if (auditor.key.some(part => part === 0n)) throw new Error('Set a registered auditor before sending.');
    const confirmed = await transaction('Private transfer', async () => (await session.sdk.transfer(to, units, current.encrypted, current.decrypted, auditor.key)).transactionHash, paymentId);
    if (!confirmed) throw new Error('No confirmed transfer receipt was returned.');
    return confirmed;
  }
  async function payBatch() {
    if (!session) return;
    await action('Processing on-chain payment run…', async () => {
      const current = await readPrivateBalance(session, address, confirmedBlock.current);
      validateBatch(batch, address, session.decimals, current.decrypted);
      // Preflight all recipients before sending the first payment.
      for (const row of batch.filter(row => row.status !== 'confirmed')) {
        const key = await session.sdk.fetchPublicKey(row.to);
        if (key.some(part => part === 0n)) throw new Error(`Register recipient ${row.to} before starting this run.`);
      }
      const result = await executeLiveBatch(batch, row => sendReviewedPayment(row.to as Address, parseLiveAmount(row.amount, session.decimals), row.id), setBatch);
      setMessage(result.every(row => row.status === 'confirmed') ? 'Every payment in this run is confirmed on Fuji.' : 'Run paused. Reconcile any pending transaction before reviewing the remaining payments.');
      await refreshBalance();
    });
  }
  async function submitPayment() {
    if (!session || !review) return;
    const payment = review; setReview(undefined);
    await action('Generating proof and sending…', async () => {
      await sendReviewedPayment(payment.to, payment.amount);
      setAmount(''); await refreshBalance();
    });
  }
  return <div className="live-controls">
    {!session && !error && <p className="live-result"><LoaderCircle size={14} className="spin"/> Verifying deployed contracts and proof file integrity…</p>}
    {error && <p role="alert" className="error-box">{error}</p>}
    {!session && error && <button className="button secondary" onClick={() => setRetryInit((n) => n + 1)}>Retry connection</button>}
    {pending && <div className="error-box"><strong>{pending.kind} needs reconciliation.</strong><p>Another transaction is blocked until the previous outcome is known.</p>{pending.hash || pending.intent ? <><label className="field">Replacement transaction hash (optional)<input value={replacementHash} onChange={event => setReplacementHash(event.target.value.trim())} placeholder="Paste speed-up or cancellation hash after a reload"/></label><button className="button secondary" disabled={!!busy} onClick={() => action('Checking transaction…', async () => {
      if (replacementHash && !/^0x[0-9a-fA-F]{64}$/.test(replacementHash)) throw new Error('Enter a valid transaction hash.');
      if (!replacementHash && !pending.hash) throw new Error('Paste the transaction hash from your wallet activity.');
      const checkedHash = (replacementHash || pending.hash!) as Hash;
      if (replacementHash && !pending.intent) throw new Error('The original transaction metadata is unavailable. Reconcile the original hash first.');
      const receipt = await publicClient.getTransactionReceipt({ hash: checkedHash });
      const actual = await publicClient.getTransaction({ hash: checkedHash });
      const outcome = pending.intent ? recoveredOutcome(pending.intent, actual, receipt.status) : confirmationOutcome(receipt.status, pending.replacementReason);
      journal(); confirmedBlock.current = receipt.blockNumber; setReplacementHash('');
      if (pending.paymentId) setBatch(rows => rows.map(row => row.id === pending.paymentId ? { ...row, status: outcome === 'confirmed' ? 'confirmed' : 'paused', hash: outcome === 'confirmed' ? receipt.transactionHash : undefined, error: outcome === 'confirmed' ? undefined : `Transaction ${outcome}.` } : row));
      setHash(receipt.transactionHash); setMessage(outcome === 'confirmed' ? 'Previous transaction confirmed. Do not resend it.' : `Previous transaction ${outcome}. Review the remaining payments before a new attempt.`);
      if (session) { const key = await session.sdk.fetchPublicKey(address); const isRegistered = key.every(part => part !== 0n); setRegistered(isRegistered); if (isRegistered && session.sdk.isDecryptionKeySet && key[0] === session.sdk.publicKey[0] && key[1] === session.sdk.publicKey[1]) { setUnlocked(true); await refreshBalance(); } }
    })}>Check recorded or replacement transaction</button>{!pending.hash && <><label className="manual-check"><input type="checkbox" checked={manualCheck} onChange={e => setManualCheck(e.target.checked)}/> I checked my wallet and no transaction was submitted.</label><button className="button secondary" disabled={!manualCheck || !!busy} onClick={() => { try { journal(); setManualCheck(false); } catch { setError('Unable to update transaction journal.'); } }}>Clear after manual verification</button></>}</> : <><p>No transaction hash was received. Inspect your wallet activity and the Fuji explorer before clearing this block.</p><label><input type="checkbox" checked={manualCheck} onChange={(e) => setManualCheck(e.target.checked)}/> I verified that no transaction was submitted.</label><button className="button secondary" disabled={!manualCheck || !!busy} onClick={() => { try { journal(); setManualCheck(false); } catch { setError('Unable to update the transaction journal.'); } }}>Clear after manual verification</button></>}</div>}
    {session && <><h3>{session.symbol || 'eERC'} · Private test token</h3><p className="muted small-text">Contract precision: {session.decimals} decimals. Amounts are read from the deployed token.</p>
      {!registered ? <button className="button primary" disabled={!!busy || !!pending} onClick={() => action('Registering encrypted wallet…', async () => {
        await transaction('Wallet registration', async () => (await session.sdk.register()).transactionHash);
        const key = await session.sdk.fetchPublicKey(address);
        if (key[0] === 0n || key[1] === 0n) throw new Error('Registration is not confirmed yet.');
        if (key[0] !== session.sdk.publicKey[0] || key[1] !== session.sdk.publicKey[1]) throw new Error('Wallet signature does not match the registered key.');
        setRegistered(true); setUnlocked(true); await refreshBalance();
      })}><KeyRound size={15}/>Register for private payments</button> : !unlocked ? <button className="button primary" disabled={!!busy} onClick={() => action('Unlocking private balance…', unlock)}><KeyRound size={15}/>Unlock with wallet signature</button> : <>
        <div className="live-balance"><span className="eyebrow">YOUR DECRYPTED BALANCE</span><strong>{balance === undefined ? 'Loading…' : formatUnits(balance, session.decimals)} <small>{session.symbol}</small></strong><button className="text-link" disabled={!!busy} onClick={() => action('Refreshing…', refreshBalance)}><RefreshCw size={12}/>Refresh balance</button></div>
        <form onSubmit={(e) => { e.preventDefault(); setError(''); try {
          if (!validAddress(recipient.trim())) throw new Error('Enter a valid recipient address.');
          if (recipient.trim().toLowerCase() === address.toLowerCase()) throw new Error('Use a different recipient wallet.');
          const units = parseLiveAmount(amount, session.decimals);
          if (balance === undefined || units > balance) throw new Error('Not enough decrypted balance.');
          setReview({ to: recipient.trim() as Address, amount: units, displayAmount: amount });
        } catch (e) { setError(e instanceof Error ? e.message : 'Invalid payment.'); } }}>
          <label className="field">Recipient wallet<input required value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x…" disabled={!!busy || !!pending}/></label>
          <label className="field">Amount ({session.symbol})<input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" disabled={!!busy || !!pending}/></label>
          <button className="button primary" type="submit" disabled={!!busy || !!pending}>Review private transfer<ArrowRight size={15}/></button>
        </form>
        <LiveBatch address={address} decimals={session.decimals} symbol={session.symbol} balance={balance} rows={batch} setRows={setBatch} busy={!!busy} blocked={!!pending} onPay={payBatch}/>
        <WalletHistory session={session} address={address}/>
        <details><summary>Auditor tools</summary><p className="live-result">Recent activity only: the last 1,000 blocks. The connected wallet must match the designated auditor. Decryption happens locally.</p><button className="button secondary" disabled={!!busy} onClick={() => action('Decrypting recent activity…', async () => {
          setAudit(await readRecentAudit(session, address));
        })}><ShieldCheck size={15}/>Decrypt recent activity</button>{audit && <pre>{serializeAudit(audit, session.decimals)}</pre>}</details>
        {session.owner.toLowerCase() === address.toLowerCase() && <details><summary>Test-token owner tools</summary><p className="live-result">Set a registered auditor before minting. These actions modify the configured testnet contract.</p><label className="field">Registered auditor wallet<input value={auditorAddress} onChange={(e) => setAuditorAddress(e.target.value)} placeholder="0x…" disabled={!!busy || !!pending}/></label><button className="button secondary" disabled={!!busy || !!pending} onClick={() => action('Setting auditor…', async () => {
          if (!validAddress(auditorAddress)) throw new Error('Enter a valid auditor wallet.');
          const key = await session.sdk.fetchPublicKey(auditorAddress);
          if (key.some((part) => part === 0n)) throw new Error('The auditor wallet must register first.');
          await transaction('Auditor configuration', () => session.sdk.setContractAuditorPublicKey(auditorAddress as Address));
        })}>Set auditor</button><button className="button secondary" disabled={!!busy || !!pending} onClick={() => action('Minting test tokens…', async () => {
          const auditor = await readAuditor(session);
          if (auditor.key.some((part) => part === 0n)) throw new Error('Configure a registered auditor first.');
          await transaction('Test-token mint', async () => (await session.sdk.privateMint(address, parseLiveAmount('10000', session.decimals), auditor.key as [bigint, bigint])).transactionHash);
          await refreshBalance();
        })}>Mint 10,000 test tokens to this wallet</button></details>}
      </>}
    </>}
    {busy && <p className="live-result" role="status"><LoaderCircle size={14} className="spin"/> {busy}</p>}
    {message && <p className="live-result" role="status"><Check size={13}/> {message}</p>}
    {hash && <a className="text-link" href={`https://testnet.snowtrace.io/tx/${hash}`} target="_blank" rel="noreferrer">View Fuji transaction<ExternalLink size={13}/></a>}
    {review && session && <Modal title="Review private transfer" onClose={() => setReview(undefined)}><div className="review-summary"><span className="eyebrow">REAL FUJI TESTNET TRANSACTION</span><strong>{review.displayAmount} <small>{session.symbol}</small></strong><p className="mono">{review.to}</p></div><div className="notice"><p>The recipient must be registered. Your wallet will request a transaction signature after proof generation. Amounts are encrypted; wallet addresses remain public.</p></div><div className="modal-actions"><button className="button secondary" onClick={() => setReview(undefined)}>Cancel</button><button className="button primary" onClick={submitPayment} disabled={!!busy || !!pending}>Confirm private transfer<ArrowRight size={15}/></button></div></Modal>}
  </div>;
}
