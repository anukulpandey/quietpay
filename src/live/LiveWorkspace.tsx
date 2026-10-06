import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { createConfig, http, WagmiProvider, useAccount, useBalance, useBlockNumber, useConnect, useDisconnect, useSwitchChain, useWalletClient } from 'wagmi';
import { injected } from '@wagmi/core';
import { avalancheFuji } from 'viem/chains';
import { formatEther, getAddress } from 'viem';
import { Check, Circle, ExternalLink as LinkIcon, FlaskConical, LoaderCircle, LockKeyhole, Wallet } from 'lucide-react';
import { ExternalLink, PrivacyNote } from '../components/Shared';
import { liveConfig, liveConfigured } from './config';
import { shortAddress } from '../lib/address';
import DeployWorkspace from './DeployWorkspace';
import { activateDeployment, upstreamCommit } from './artifacts';
import { publicClient } from './chain';
import { verifyStandaloneDeployment } from './verify';

const config = createConfig({ chains: [avalancheFuji], connectors: [injected()], transports: { [avalancheFuji.id]: http(undefined,{timeout:15000,retryCount:1}) }, storage: null });
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const EercPanel = lazy(() => import('./EercPanel'));
class IntegrationBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
 state = { error: false };
 static getDerivedStateFromError() { return { error: true }; }
 render() { return this.state.error ? <p className="error-box">The encrypted payment module could not load. Reload after checking the deployment. No payment is shown as complete.</p> : this.props.children; }
}
function Workspace(){
 const {address,chainId,isConnected}=useAccount();
 const {connectors,connectAsync,isPending}=useConnect();const {disconnect}=useDisconnect();const {switchChainAsync}=useSwitchChain();
 const {data:wallet}=useWalletClient();
 const {data:gasBalance}=useBalance({address,chainId:43113,query:{enabled:!!address,refetchInterval:15000}});
 const {data:block,isError:rpcError}=useBlockNumber({chainId:43113,query:{refetchInterval:15000}});
 const [existing,setExisting]=useState('');const [importing,setImporting]=useState(false);const [importError,setImportError]=useState('');
 const [error,setError]=useState('');const [switching,setSwitching]=useState(false);
 const available=connectors.filter(c=>c.id!=='injected'||!connectors.some(other=>other.id!=='injected'));
 return <>
  <div className="page-heading avalanche-hero"><div><span className="eyebrow">PRIVATE PAYMENTS / AVALANCHE FUJI</span><h1>PAY ON-CHAIN.<br/>KEEP IT PRIVATE<span className="accent-period">.</span></h1><p>Your wallet. Encrypted balances. Receipts confirmed on Avalanche.</p></div><span className="environment-pill live"><span/>{block?`Fuji · Block ${block.toLocaleString()}`:rpcError?'Fuji RPC unavailable':'Connecting to Fuji…'}</span></div>
  <div className={`live-grid ${liveConfigured?'ready':''}`}>
   <div className="setup-card"><Wallet size={26}/><h2>{isConnected?'Your Fuji wallet.':'Connect your wallet.'}</h2><p>{isConnected?'Test AVAX pays network fees. QTEST is your private test token.':'Connect Core, MetaMask, or another EVM wallet to deploy and use your private payment workspace.'}</p>
   {!isConnected?<div className="wallet-connectors">{available.map(connector=><button className="button primary" key={connector.uid} disabled={isPending} onClick={async()=>{setError('');try{const provider=await connector.getProvider();if(!provider)throw new Error('No browser wallet found. Open this URL in Chrome with Core or MetaMask installed, then connect.');await connectAsync({connector,chainId:43113});}catch(e){setError(e instanceof Error?e.message.split('\n')[0]:'Wallet connection failed.');}}}>{isPending?<LoaderCircle size={15} className="spin"/>:<Wallet size={15}/>}Connect {connector.name==='Injected'?'wallet':connector.name}</button>)}</div>:<div className="wallet-info"><span><Check size={15}/>{shortAddress(address!)} · {chainId===43113?'Avalanche Fuji':'Wrong network'}</span><p className="live-address mono">{address}</p><p className="live-result">{gasBalance?`${Number(formatEther(gasBalance.value)).toFixed(5)} test AVAX for gas`:'Reading test AVAX balance…'}</p><div className="live-actions"><button className="button secondary" onClick={()=>{disconnect();queryClient.clear();}}>Disconnect</button>{chainId!==43113&&<button className="button primary" disabled={switching} onClick={async()=>{setSwitching(true);setError('');try{await switchChainAsync({chainId:43113});}catch(e){setError(e instanceof Error?e.message.split('\n')[0]:'Network switch failed.');}finally{setSwitching(false);}}}>Switch to Fuji</button>}</div></div>}
   {error&&<p className="error-box" role="alert">{error}</p>}
   {wallet&&address&&chainId===43113&&liveConfigured?<IntegrationBoundary key={`${address}-${chainId}`}><Suspense fallback={<p className="live-result">Loading encrypted payment tools…</p>}><EercPanel wallet={wallet} address={address}/></Suspense></IntegrationBoundary>:<div className="notice"><LockKeyhole size={17}/><p>{liveConfigured?'Connect on Fuji to verify the contract and proof files, then unlock your real encrypted balance.':'Deploy the private token to create your Avalanche workspace and unlock encrypted payments.'}</p></div>}
   <div className="setup-links"><ExternalLink href="https://core.app/tools/testnet-faucet/">Get free Fuji test AVAX</ExternalLink><ExternalLink href="https://core.app/">Get a Core wallet</ExternalLink></div>
   </div>
   <div className="setup-card"><FlaskConical size={26}/><h2>{liveConfigured?'Your on-chain workspace.':'Deploy QuietPay on Fuji.'}</h2><p>{liveConfigured?'The connected wallet controls access. Balances are decrypted locally after a wallet signature.':'The official eERC contracts and matching proof files are bundled. Deploy directly from your wallet; no private key or server is needed.'}</p>
   {wallet&&address&&chainId===43113&&!liveConfigured?<DeployWorkspace key={address} wallet={wallet} address={address}/>:<ul className="setup-list"><li>{liveConfig.address?<Check size={15}/>:<Circle size={15}/>}<span><strong>{liveConfig.address?'Contract configured':'1. Connect a funded Fuji wallet'}</strong><small>{liveConfig.address?liveConfig.address:'Use the faucet for free test AVAX. This app only sends transactions on chain 43113.'}</small></span></li><li><Check size={15}/><span><strong>Official proof files included</strong><small>Registration, mint, and transfer artifacts are SHA-256 checked before enabling private payments.</small></span></li><li><Circle size={15}/><span><strong>{liveConfigured?'Register → unlock → pay':'2. Deploy → register → set auditor'}</strong><small>{liveConfigured?'Register each recipient wallet. The owner can mint QTEST after setting a registered auditor.':'Approve the eight deployment transactions, then activate your token. The owner sets a registered auditor and mints test tokens.'}</small></span></li></ul>}
   {!liveConfigured&&<details className="import-deployment"><summary>Join an existing QuietPay deployment</summary><p className="live-result">Recipients and auditors use the same token contract as their payer.</p><label className="field">Fuji token contract address<input value={existing} onChange={event=>setExisting(event.target.value.trim())} placeholder="0x…" disabled={importing}/></label>{importError&&<p className="error-box">{importError}</p>}<button className="button secondary" disabled={importing||!existing} onClick={async()=>{setImporting(true);setImportError('');try{const contract=getAddress(existing);await verifyStandaloneDeployment(publicClient,contract);activateDeployment(contract);window.location.reload();}catch(e){setImportError(e instanceof Error?e.message.split('\n')[0]:'Contract verification failed.');}finally{setImporting(false);}}}>{importing?'Verifying all contracts…':'Verify and join'}</button></details>}
   <div className="setup-links">{liveConfig.address&&<ExternalLink href={`https://testnet.snowtrace.io/address/${liveConfig.address}`}>View contract on Fuji<LinkIcon size={12}/></ExternalLink>}<ExternalLink href={`https://github.com/ava-labs/EncryptedERC/tree/${upstreamCommit}`}>Pinned official contract source</ExternalLink><a className="text-link" href="/circuits/LICENSE.md" target="_blank" rel="noreferrer">Ava Labs Ecosystem License</a></div>
   </div>
  </div><PrivacyNote/>
 </>;
}
export default function LiveWorkspace(){return <WagmiProvider config={config}><QueryClientProvider client={queryClient}><Workspace/></QueryClientProvider></WagmiProvider>;}
