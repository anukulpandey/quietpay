import { decodeFunctionData, parseAbiItem, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import type { EERC } from '@avalabs/eerc-sdk';
export type ReceiptRow={hash:Hex;block:bigint;peer:Address;direction:'received'|'sent'|'minted';amount?:bigint;error?:string};
const transferEvent=parseAbiItem('event PrivateTransfer(address indexed from, address indexed to, uint256[7] auditorPCT, address indexed auditorAddress)');
const mintEvent=parseAbiItem('event PrivateMint(address indexed user, uint256[7] auditorPCT, address indexed auditorAddress)');
export async function readWalletActivity(client:PublicClient,sdk:EERC,address:Address,before?:bigint){
 const toBlock=before??await client.getBlockNumber();const fromBlock=toBlock>999n?toBlock-999n:0n;
 const contract={address:sdk.contractAddress,fromBlock,toBlock,strict:true as const};
 const [outgoing,incoming,mints]=await Promise.all([
  client.getLogs({...contract,event:transferEvent,args:{from:address}}),
  client.getLogs({...contract,event:transferEvent,args:{to:address}}),
  client.getLogs({...contract,event:mintEvent,args:{user:address}}),
 ]);
 const rows:ReceiptRow[]=outgoing.map(log=>({hash:log.transactionHash,block:log.blockNumber,peer:log.args.to,direction:'sent'}));
 // Match the receiver PCT slots in the pinned EncryptedERC._extractTransferInputs
 // and _executePrivateMint. Decrypt only calldata addressed to this wallet.
 for(const log of [...incoming,...mints]){
  const isMint=log.eventName==='PrivateMint';
  const row:ReceiptRow={hash:log.transactionHash,block:log.blockNumber,peer:isMint?address:log.args.from,direction:isMint?'minted':'received'};
  try{
   const tx=await client.getTransaction({hash:log.transactionHash});
   if(tx.to?.toLowerCase()!==sdk.contractAddress.toLowerCase())throw new Error('Nested transfer: amount is available in your balance.');
   const decoded=decodeFunctionData({abi:sdk.encryptedErcAbi as Abi,data:tx.input});
   if(decoded.functionName!==(isMint?'privateMint':'transfer') || String(decoded.args?.[0]).toLowerCase()!==address.toLowerCase())throw new Error('Transaction does not match this receipt.');
   const proof=decoded.args?.[isMint?1:2] as {publicSignals:readonly bigint[]};
   const start=isMint?8:16;
   row.amount=sdk.decryptPCT([...proof.publicSignals.slice(start,start+7)]);
  }catch(e){row.error=e instanceof Error?e.message:'Amount could not be decrypted.';}
  rows.push(row);
 }
 return {rows:rows.sort((a,b)=>a.block>b.block?-1:a.block<b.block?1:0),fromBlock,toBlock};
}
