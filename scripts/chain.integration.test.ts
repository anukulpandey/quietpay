import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ganache from 'ganache';
import { createPublicClient, createWalletClient, custom, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { journalWallet } from '../src/live/journalWallet';
import { recoveredOutcome, type TransactionIntent } from '../src/live/transactions';
import { verifyStandaloneDeployment } from '../src/live/verify';
import { readWalletActivity } from '../src/live/history';
import { EERC } from '../node_modules/@avalabs/eerc-sdk/dist/index.js';
import { deploymentSteps, deploymentArgs, linkBytecode, matchesRuntime, runtimeForDeployment, type DeployedContracts, type DeploymentManifest } from '../src/live/deployment';

it('deploys official contracts, verifies proofs, transfers and decrypts balances and audit data', async()=>{
 const provider=ganache.provider({chain:{chainId:43113,hardfork:'shanghai'},wallet:{totalAccounts:3,defaultBalance:100},logging:{quiet:true}});
 try {
  const manifest=JSON.parse(fs.readFileSync('public/deployment/manifest.json','utf8')) as DeploymentManifest;
  const accounts=Object.values(provider.getInitialAccounts()).map(a=>privateKeyToAccount(a.secretKey as `0x${string}`));
  const client=createPublicClient({chain:avalancheFuji,transport:custom(provider),pollingInterval:50});
  const wallets=accounts.map(account=>createWalletClient({account,chain:avalancheFuji,transport:custom(provider)}));
  const deployed:DeployedContracts={};
  for(const step of deploymentSteps){
   const artifact=manifest.artifacts[step];
   const hash=await wallets[0].deployContract({abi:artifact.abi,bytecode:linkBytecode(artifact,deployed),args:deploymentArgs(step,deployed)});
   const receipt=await client.waitForTransactionReceipt({hash}); expect(receipt.status).toBe('success');
   deployed[step]=receipt.contractAddress!;
   const code=await client.getCode({address:receipt.contractAddress!});
   expect(matchesRuntime(code!,runtimeForDeployment(step,artifact,deployed,receipt.contractAddress!),artifact.immutableReferences)).toBe(true);
  }
  const verified=await verifyStandaloneDeployment(client as any,deployed.EncryptedERC!,manifest);
  for(const step of deploymentSteps)expect(verified[step]?.toLowerCase()).toBe(deployed[step]?.toLowerCase());
  console.log('8 official contracts deployed to isolated local EVM (Fuji chain ID).');
  const circuits=Object.fromEntries([['register','Registration'],['mint','Mint'],['transfer','Transfer'],['withdraw','Withdraw'],['burn','Burn']].map(([key,name])=>[key,{wasm:path.resolve(`public/circuits/${name}Circuit.wasm`),zkey:path.resolve(`public/circuits/${name}Circuit.zkey`)}]));
  const intents:TransactionIntent[]=[];
  const sessions=wallets.map(wallet=>new EERC(client as any,journalWallet(client as any,wallet as any,intent=>intents.push(intent)),deployed.EncryptedERC!,deployed.Registrar!,false,circuits as any));
  const receipt=async(hash:string)=>{expect((await client.waitForTransactionReceipt({hash:hash as `0x${string}`})).status).toBe('success');};
  for(const sdk of sessions) await receipt((await sdk.register()).transactionHash);
  console.log('Three wallet registrations proved and confirmed.');
  await receipt(await sessions[0].setContractAuditorPublicKey(accounts[2].address));
  await receipt((await sessions[0].privateMint(accounts[0].address,10000000000n,sessions[2].publicKey as [bigint,bigint])).transactionHash);
  const balance=async(index:number)=>{
   const raw=await client.readContract({address:deployed.EncryptedERC!,abi:manifest.artifacts.EncryptedERC.abi,functionName:'balanceOf',args:[accounts[index].address,0n]}) as any;
   return {amount:sessions[index].calculateTotalBalance(raw[0],raw[2],raw[3]),encrypted:[raw[0].c1.x,raw[0].c1.y,raw[0].c2.x,raw[0].c2.y]};
  };
  expect((await balance(0)).amount).toBe(10000000000n);
  const before=await balance(0);
  const transfer=await sessions[0].transfer(accounts[1].address,1500250000n,before.encrypted,before.amount,sessions[2].publicKey);
  await receipt(transfer.transactionHash);
  const confirmedTx=await client.getTransaction({hash:transfer.transactionHash as `0x${string}`});
  expect(recoveredOutcome(intents.at(-1)!,confirmedTx,'success')).toBe('confirmed');
  expect(intents.at(-1)?.input).toBe(confirmedTx.input);
  expect((await balance(0)).amount).toBe(8499750000n);
  expect((await balance(1)).amount).toBe(1500250000n);
  const logs=await client.getLogs({address:deployed.EncryptedERC!,event:parseAbiItem('event PrivateTransfer(address indexed from, address indexed to, uint256[7] auditorPCT, address indexed auditorAddress)'),fromBlock:0n,toBlock:'latest',strict:true});
  expect(logs).toHaveLength(1);
  expect(sessions[2].decryptPCT([...logs[0].args.auditorPCT])).toBe(1500250000n);
  const recipientHistory=await readWalletActivity(client as any,sessions[1],accounts[1].address);
  expect(recipientHistory.rows[0].amount).toBe(1500250000n);
  const ownerHistory=await readWalletActivity(client as any,sessions[0],accounts[0].address);
  expect(ownerHistory.rows.find(row=>row.direction==='minted')?.amount).toBe(10000000000n);
  const recipientUnlock=new EERC(client as any,wallets[1] as any,deployed.EncryptedERC!,deployed.Registrar!,false,circuits as any);
  await recipientUnlock.generateDecryptionKey();
  expect(recipientUnlock.publicKey).toEqual(sessions[1].publicKey);
  console.log('Mint + encrypted transfer + payer/recipient balances + auditor decryption + repeat wallet unlock verified.');
 } finally { await provider.disconnect(); }
},240000);
