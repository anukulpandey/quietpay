import { encodeFunctionData, type PublicClient, type WalletClient } from 'viem';
import type { TransactionIntent } from './transactions';
/** Capture public calldata and the exact nonce before handing a call to the wallet. */
export function journalWallet(client:PublicClient,wallet:WalletClient,beforeSend:(intent:TransactionIntent)=>void):WalletClient{
 return {...wallet,writeContract:(async(request:Parameters<WalletClient['writeContract']>[0])=>{
  const account=wallet.account?.address;
  if(!account||await wallet.getChainId()!==43113||(await wallet.getAddresses())[0]?.toLowerCase()!==account.toLowerCase())throw new Error('Wallet account or network changed. Reconnect before sending.');
  const nonce=await client.getTransactionCount({address:account,blockTag:'pending'});
  const input=encodeFunctionData({abi:request.abi,functionName:request.functionName,args:request.args});
  beforeSend({from:account,to:request.address,input,value:(request.value??0n).toString(),nonce});
  return wallet.writeContract({...request,nonce});
 }) as WalletClient['writeContract']};
}
