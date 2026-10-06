import '../src/live/browser';
import { EERC } from '@avalabs/eerc-sdk';
import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { deploymentSteps, deploymentArgs, linkBytecode, type DeployedContracts } from '../src/live/deployment';
import { loadManifest, verifyCircuitAssets } from '../src/live/artifacts';
import { verifyStandaloneDeployment } from '../src/live/verify';
import { journalWallet } from '../src/live/journalWallet';
import { readWalletActivity } from '../src/live/history';
const output=document.querySelector<HTMLPreElement>('#result')!;
const button=document.querySelector<HTMLButtonElement>('#run')!;
const log=(text:string)=>{output.textContent+=`\n${text}`;};
button.onclick=async()=>{
 button.disabled=true;output.textContent='Running isolated test…';
 try{
  const manifest=await loadManifest();await verifyCircuitAssets('/circuits');log('PASS: bundled proof hashes checked in browser.');
  const client=createPublicClient({chain:avalancheFuji,transport:http('http://127.0.0.1:8547'),pollingInterval:100});
  const accounts=[1,2,3].map(n=>privateKeyToAccount(`0x${n.toString(16).padStart(64,'0')}`));
  const wallets=accounts.map(account=>createWalletClient({account,chain:avalancheFuji,transport:http('http://127.0.0.1:8547')}));
  const contracts:DeployedContracts={};
  for(const step of deploymentSteps){const artifact=manifest.artifacts[step];const hash=await wallets[0].deployContract({abi:artifact.abi,bytecode:linkBytecode(artifact,contracts),args:deploymentArgs(step,contracts)});const receipt=await client.waitForTransactionReceipt({hash});if(receipt.status!=='success')throw new Error(`${step} reverted`);contracts[step]=receipt.contractAddress!;}
  await verifyStandaloneDeployment(client,contracts.EncryptedERC!,manifest);log('PASS: eight deployed contract runtimes verified.');
  const circuits=Object.fromEntries([['register','Registration'],['mint','Mint'],['transfer','Transfer'],['withdraw','Withdraw'],['burn','Burn']].map(([key,name])=>[key,{wasm:new URL(`/circuits/${name}Circuit.wasm`,location.origin).href,zkey:new URL(`/circuits/${name}Circuit.zkey`,location.origin).href}]));
  const sessions=wallets.map(wallet=>new EERC(client,journalWallet(client,wallet,()=>{}),contracts.EncryptedERC!,contracts.Registrar!,false,circuits as any));
  const confirm=async(hash:string)=>{const result=await client.waitForTransactionReceipt({hash:hash as `0x${string}`});if(result.status!=='success')throw new Error('Transaction reverted');};
  for(const sdk of sessions){await confirm((await sdk.register()).transactionHash);log('PASS: registration proof generated in browser and verified on local EVM.');}
  await confirm(await sessions[0].setContractAuditorPublicKey(accounts[2].address));
  await confirm((await sessions[0].privateMint(accounts[0].address,10000000000n,sessions[2].publicKey as [bigint,bigint])).transactionHash);log('PASS: browser mint proof + transaction.');
  const balance=async(index:number)=>{const raw=await client.readContract({address:contracts.EncryptedERC!,abi:manifest.artifacts.EncryptedERC.abi,functionName:'balanceOf',args:[accounts[index].address,0n]}) as any;return {amount:sessions[index].calculateTotalBalance(raw[0],raw[2],raw[3]),encrypted:[raw[0].c1.x,raw[0].c1.y,raw[0].c2.x,raw[0].c2.y]};};
  const before=await balance(0);await confirm((await sessions[0].transfer(accounts[1].address,100250000n,before.encrypted,before.amount,sessions[2].publicKey)).transactionHash);
  if((await balance(1)).amount!==100250000n||(await balance(0)).amount!==9899750000n)throw new Error('Balance mismatch');
  const received=await readWalletActivity(client,sessions[1],accounts[1].address as Address);if(received.rows[0]?.amount!==100250000n)throw new Error('Receipt decryption failed');
  log('PASS: browser transfer proof, both balances, and recipient receipt.');log('ALL BROWSER CHECKS PASSED (local EVM only).');
 }catch(error){log(`FAILED: ${error instanceof Error?error.message:String(error)}`);console.error(error);}finally{button.disabled=false;}
};
