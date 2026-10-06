import { useEffect, useRef, useState } from 'react';
import { encodeDeployData, formatEther, type Address, type Hash, type WalletClient } from 'viem';
import { Check, ExternalLink, LoaderCircle, Rocket } from 'lucide-react';
import { publicClient } from './chain';
import { activateDeployment, loadManifest, upstreamCommit } from './artifacts';
import { deploymentArgs, deploymentSteps, linkBytecode, matchesRuntime, runtimeForDeployment, type DeployedContracts, type DeploymentManifest, type DeploymentStep } from './deployment';
import { confirmationOutcome, recoveredOutcome, type TransactionIntent, type ReplacementReason } from './transactions';

type Progress={contracts:DeployedContracts;receipts:Partial<Record<DeploymentStep,Hash>>;pending?:{intent?:TransactionIntent;step:DeploymentStep;hash?:Hash;replacementReason?:ReplacementReason}};
const empty=():Progress=>({contracts:{},receipts:{}});
export default function DeployWorkspace({wallet,address}:{wallet:WalletClient;address:Address}){
 const key=`quietpay.deploy.43113.${upstreamCommit}.${address.toLowerCase()}`;
 const [manifest,setManifest]=useState<DeploymentManifest>();
 const [state,setState]=useState<Progress>(empty);
 const stateRef=useRef(state);
 const [error,setError]=useState(''); const [busy,setBusy]=useState(''); const [fee,setFee]=useState('');
 const [replacementHash,setReplacementHash]=useState('');
 const [manual,setManual]=useState(false);const inFlight=useRef(false);
 useEffect(()=>{try{const saved=localStorage.getItem(key);const parsed=saved?JSON.parse(saved):empty();if(!parsed.contracts||!parsed.receipts)throw new Error('Invalid deployment journal');stateRef.current=parsed;setState(parsed);}catch{setError('Cannot read the deployment journal. Restore browser storage before deploying.');}loadManifest().then(setManifest).catch(e=>setError(e.message));},[key]);
 const next=deploymentSteps.find(step=>!state.contracts[step]);
 function save(value:Progress){localStorage.setItem(key,JSON.stringify(value));stateRef.current=value;setState(value);}
 async function verify(step:DeploymentStep,contract:Address,contracts:DeployedContracts){
  const artifact=manifest!.artifacts[step];const actual=await publicClient.getCode({address:contract});
  if(!actual || !matchesRuntime(actual,runtimeForDeployment(step,artifact,contracts,contract),artifact.immutableReferences))throw new Error(`${step} deployed code does not match the compiled bundle.`);
 }
 async function reconcile(progress:Progress, alternative?:Hash){
  const pending=progress.pending;const hash=alternative||pending?.hash;if(!pending||!hash)throw new Error('Paste the transaction hash from your wallet activity.');
  if(alternative&&!pending.intent)throw new Error('Original transaction metadata is missing. Reconcile the recorded hash.');
  setBusy(`Confirming ${pending.step}…`);
  let reason=pending.replacementReason;
  const receipt=await publicClient.waitForTransactionReceipt({hash,timeout:120000,onReplaced:replacement=>{
   reason=replacement.reason; save({...progress,pending:{...pending,step:pending.step,hash:replacement.transaction.hash,replacementReason:reason}});
  }});
  const actual=await publicClient.getTransaction({hash:receipt.transactionHash});
  const outcome=pending.intent?recoveredOutcome(pending.intent,actual,receipt.status):confirmationOutcome(receipt.status,reason);
  if(outcome!=='confirmed'){
   save({...progress,pending:undefined});throw new Error('Deployment was cancelled, replaced, or reverted. It has not been marked complete.');
  }
  if(!receipt.contractAddress || receipt.from.toLowerCase()!==address.toLowerCase())throw new Error('Receipt is not a deployment from this wallet.');
  const artifact=manifest!.artifacts[pending.step];
  const expected=encodeDeployData({abi:artifact.abi,bytecode:linkBytecode(artifact,progress.contracts),args:deploymentArgs(pending.step,progress.contracts)});
  const transaction=actual;
  if(transaction.to!==null || transaction.input.toLowerCase()!==expected.toLowerCase())throw new Error('Confirmed transaction differs from the reviewed deployment.');
  await verify(pending.step,receipt.contractAddress,progress.contracts);
  save({contracts:{...progress.contracts,[pending.step]:receipt.contractAddress},receipts:{...progress.receipts,[pending.step]:receipt.transactionHash}});
  setFee('');setReplacementHash('');
 }
 async function run(operation:()=>Promise<void>){
  if(inFlight.current)return;inFlight.current=true;setError('');
  try{
   if(!navigator.locks)throw new Error('This browser needs Web Locks for safe deployment.');
   await navigator.locks.request(key,{ifAvailable:true},async lock=>{
    if(!lock)throw new Error('Another tab is deploying.');
    if(await wallet.getChainId()!==43113)throw new Error('Switch your wallet to Avalanche Fuji.');
    const accounts=await wallet.getAddresses();if(accounts[0]?.toLowerCase()!==address.toLowerCase())throw new Error('The wallet account changed. Reconnect before continuing.');
    const saved=localStorage.getItem(key);const fresh=saved?JSON.parse(saved):empty();stateRef.current=fresh;setState(fresh);
    await operation();
   });
  }catch(e){setError(e instanceof Error?e.message.split('\n').slice(0,2).join(' '):'Deployment failed.');}
  finally{inFlight.current=false;setBusy('');}
 }
 async function deployNext(){
  const progress=stateRef.current;
  if(progress.pending)throw new Error('Reconcile the pending deployment first.');
  const step=deploymentSteps.find(s=>!progress.contracts[s]);if(!step||!manifest)return;
  setBusy('Checking contracts and estimating gas…');
  for(const previous of deploymentSteps){const contract=progress.contracts[previous];if(contract)await verify(previous,contract,progress.contracts);}
  const artifact=manifest.artifacts[step];const bytecode=linkBytecode(artifact,progress.contracts);const args=deploymentArgs(step,progress.contracts);
  const data=encodeDeployData({abi:artifact.abi,bytecode,args});
  const gas=await publicClient.estimateGas({account:address,data});
  const price=await publicClient.getGasPrice();const gasLimit=gas*120n/100n;
  setFee(`Estimated network fee: ~${formatEther(gasLimit*price)} test AVAX. Your wallet shows the final fee.`);
  if(await publicClient.getBalance({address})<gasLimit*price)throw new Error('Not enough Fuji AVAX for deployment. Use the faucet link to fund this wallet.');
  const nonce=await publicClient.getTransactionCount({address,blockTag:'pending'});
  const intent:TransactionIntent={from:address,to:null,input:data,value:'0',nonce};
  save({...progress,pending:{step,intent}});setBusy(`Approve ${step} in your wallet…`);
  let hash:Hash;
  try{hash=await wallet.deployContract({account:address,chain:publicClient.chain,abi:artifact.abi,bytecode,args,gas:gasLimit,nonce});}
  catch(e){let cause:unknown=e;for(let i=0;i<8&&cause&&typeof cause==='object';i++){const value=cause as {code?:number;cause?:unknown};if(value.code===4001){save(progress);break;}cause=value.cause;}throw e;}
  const pending={...progress,pending:{step,hash,intent}};save(pending);await reconcile(pending);
 }
 return <div className="deployment-wizard"><div className="notice"><Rocket size={18}/><p>Deploy your own private test token. Eight contracts, eight wallet approvals, paid in test AVAX. Your wallet becomes the token owner.</p></div>
  <ol className="deployment-steps">{deploymentSteps.map((step,index)=><li key={step} className={state.contracts[step]?'complete':next===step?'current':''}><span>{state.contracts[step]?<Check size={13}/>:String(index+1).padStart(2,'0')}</span><div><strong>{step==='EncryptedERC'?'QuietPay private token':step.replace(/([a-z])([A-Z])/g,'$1 $2')}</strong>{state.contracts[step]&&<a href={`https://testnet.snowtrace.io/address/${state.contracts[step]}`} target="_blank" rel="noreferrer">{state.contracts[step]} <ExternalLink size={10}/></a>}</div></li>)}</ol>
  {error&&<p className="error-box" role="alert">{error}</p>}{fee&&<p className="live-result">{fee}</p>}{busy&&<p role="status" className="live-result"><LoaderCircle className="spin" size={15}/> {busy}</p>}
  {state.pending?<div className="notice"><div><p>{state.pending.step} is awaiting confirmation. Further deployments are blocked.</p>{state.pending.hash&&<a className="text-link" href={`https://testnet.snowtrace.io/tx/${state.pending.hash}`} target="_blank" rel="noreferrer">View pending transaction</a>}<label className="field">Transaction or replacement hash<input value={replacementHash} onChange={event=>setReplacementHash(event.target.value.trim())} placeholder="Optional speed-up / cancellation hash"/></label><button className="button secondary" disabled={!!busy||!manifest} onClick={()=>run(async()=>{if(replacementHash&&!/^0x[0-9a-fA-F]{64}$/.test(replacementHash))throw new Error('Enter a valid transaction hash.');await reconcile(stateRef.current,replacementHash?replacementHash as Hash:undefined);})}>Check transaction</button>{!state.pending.hash&&<><p>No hash was returned. Check the wallet activity before clearing the submission.</p><label className="manual-check"><input type="checkbox" checked={manual} onChange={e=>setManual(e.target.checked)}/> I checked my wallet and no transaction was submitted.</label><button className="button secondary" disabled={!manual||!!busy} onClick={()=>run(async()=>{save({...stateRef.current,pending:undefined});setManual(false);})}>Clear after verification</button></>}</div></div>:next?<button className="button primary" disabled={!!busy||!manifest} onClick={()=>run(deployNext)}><Rocket size={15}/>Deploy {next==='EncryptedERC'?'QuietPay token':next}</button>:<button className="button primary" disabled={!!busy} onClick={()=>run(async()=>{for(const step of deploymentSteps)await verify(step,stateRef.current.contracts[step]!,stateRef.current.contracts);activateDeployment(stateRef.current.contracts.EncryptedERC!);window.location.reload();})}>Activate verified Fuji deployment</button>}
  <p className="live-result">Progress is saved for this wallet on this browser. Contract addresses and transaction hashes are public; no keys are stored.</p>
 </div>;
}
