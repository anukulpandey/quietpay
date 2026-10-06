import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowUpRight, Check, CircleHelp, Eye, Menu, ShieldCheck, Wallet } from 'lucide-react';
import { Modal } from './components/Modal';
import { AvalancheMark } from './components/AvalancheMark';

const LiveWorkspace = lazy(() => import('./live/LiveWorkspace'));

export default function App() {
  const [help, setHelp] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    // Retire only the former simulated workspace; preserve all on-chain journals.
    try { localStorage.removeItem('quietpay.practice.v1'); } catch { /* Storage may be disabled. */ }
  }, []);

  return <div className="app-shell">
    {mobileMenu && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <button className="brand" onClick={() => setMobileMenu(false)} aria-label="QuietPay home"><AvalancheMark className="brand-avalanche"/><span className="brand-wordmark">QUIETPAY<span className="brand-period">.</span><small>ON AVALANCHE</small></span></button>
      <div className="workspace-card"><span className="workspace-avatar"><AvalancheMark/></span><span><strong>QuietPay on Fuji</strong><small>On-chain workspace</small></span></div>
      <span className="nav-label">ON AVALANCHE</span>
      <nav aria-label="Workspace navigation"><button className="nav-item active" aria-current="page" onClick={() => setMobileMenu(false)}><Wallet size={18}/>On-chain payments</button></nav>
      <span className="nav-label second">NETWORK RESOURCES</span>
      <nav aria-label="Avalanche resources">
        <a className="nav-item" href="https://testnet.snowtrace.io/" target="_blank" rel="noreferrer"><ArrowUpRight size={18}/>Fuji explorer</a>
        <a className="nav-item" href="https://core.app/tools/testnet-faucet/" target="_blank" rel="noreferrer"><Wallet size={18}/>Get test AVAX</a>
      </nav>
      <div className="sidebar-bottom">
        <div className="fuji-promo"><div className="promo-icon"><ShieldCheck size={18}/><span>BUILT ON AVALANCHE</span></div><h3>Your private payment network.</h3><p>Deploy, register, and send encrypted payments on Fuji.</p></div>
        <button className="help-button" onClick={() => { setHelp(true); setMobileMenu(false); }}><CircleHelp size={17}/>Payment guide<ArrowUpRight size={14}/></button>
        <div className="sidebar-user"><AvalancheMark className="network-mark"/><span><strong>Avalanche Fuji</strong><small>Testnet · Chain 43113</small></span></div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="breadcrumbs"><button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Menu size={20}/></button><span>QuietPay</span><span className="breadcrumb-slash">/</span><strong>Fuji workspace</strong></div>
        <div className="topbar-right"><a className="builder-link" href="https://build.avax.network" target="_blank" rel="noreferrer">Builder Hub<ArrowUpRight size={13}/></a><span className="environment-pill live"><span/>Fuji testnet</span><button className="icon-button topbar-profile" onClick={() => setHelp(true)} aria-label="Open payment guide"><CircleHelp size={19}/></button></div>
      </header>
      <main>
        <Suspense fallback={<div className="empty-state" role="status">Loading the Fuji workspace…</div>}><LiveWorkspace/></Suspense>
        <footer className="footer"><span>QUIETPAY / PRIVATE BY DESIGN</span><span className="footer-avalanche"><AvalancheMark/>Built for Avalanche Speedrun</span></footer>
      </main>
    </div>
    {help && <Modal title="Private payments on Avalanche." onClose={() => setHelp(false)}>
      <div className="help-content"><span className="large-icon"><ShieldCheck size={28}/></span><p>QuietPay uses your wallet and Avalanche’s encrypted ERC contracts for private payments on Fuji.</p>
        <ol>
          <li><strong>Connect and deploy.</strong> Connect Core or MetaMask on Fuji, fund network fees with test AVAX, and approve the eight contract deployments. You can also join an existing verified deployment.</li>
          <li><strong>Register and unlock.</strong> Register each payer, recipient, and auditor wallet. Sign with your wallet to unlock your encrypted balance. The token owner sets a registered auditor and mints QTEST.</li>
          <li><strong>Review and pay.</strong> Enter recipient wallets and amounts, review the payment, then approve each transaction. Receipts appear after confirmation on Avalanche.</li>
          <li><strong>Read your activity.</strong> Recipients unlock their own balances and receipts. The designated auditor can decrypt recent payment activity with their wallet.</li>
        </ol>
        <p>Fuji is Avalanche’s testnet. Test AVAX and QTEST have no real value.</p>
        <div className="notice"><Eye size={18}/><p>Balances and transfer amounts are encrypted. Wallet addresses and timing remain public; the designated auditor can decrypt amounts within their scope.</p></div>
      </div><div className="modal-actions"><button className="button primary" onClick={() => setHelp(false)}>Got it<Check size={16}/></button></div>
    </Modal>}
  </div>;
}
