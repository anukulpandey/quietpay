import { isAddress, type Hash } from 'viem';
import { parseLiveAmount } from './amount';
export type LivePayment={id:string;to:string;amount:string;status:'ready'|'submitting'|'confirmed'|'paused';hash?:Hash;error?:string};
export function validateBatch(rows:LivePayment[],sender:string,decimals:number,balance:bigint):bigint{
 if(!rows.length || rows.length>20)throw new Error('Choose between 1 and 20 recipients.');
 const seen=new Set<string>();let total=0n;
 for(const row of rows){
  if(!isAddress(row.to)||/^0x0{40}$/i.test(row.to))throw new Error('Enter a valid recipient wallet.');
  if(row.to.toLowerCase()===sender.toLowerCase())throw new Error('Do not send to your own wallet.');
  if(seen.has(row.to.toLowerCase()))throw new Error('Duplicate recipient wallet.');seen.add(row.to.toLowerCase());
  const amount=parseLiveAmount(row.amount,decimals);if(row.status!=='confirmed')total+=amount;
 }
 if(total>balance)throw new Error('Not enough encrypted balance for this payment run.');return total;
}
export async function executeLiveBatch(rows:LivePayment[],send:(row:LivePayment)=>Promise<Hash>,update:(rows:LivePayment[])=>void){
 let result=rows.map(row=>({...row}));
 for(let index=0;index<result.length;index++){
  if(result[index].status==='confirmed')continue;
  result=result.map((row,i)=>i===index?{...row,status:'submitting',error:undefined}:row);update(result);
  try{const hash=await send(result[index]);result=result.map((row,i)=>i===index?{...row,status:'confirmed',hash}:row);update(result);}
  catch(error){result=result.map((row,i)=>i===index?{...row,status:'paused',error:error instanceof Error?error.message:'Payment outcome needs review.'}:row);update(result);break;}
 }
 return result;
}
