import { formatUnits } from 'viem';

export type ReplacementReason = 'repriced' | 'cancelled' | 'replaced';
export function confirmationOutcome(status: string, reason?: ReplacementReason): 'confirmed' | 'reverted' | 'cancelled' | 'replaced' {
  if (status !== 'success') return 'reverted';
  if (reason === 'cancelled' || reason === 'replaced') return reason;
  return 'confirmed';
}
export function serializeAudit(rows: { amount?: string; [key: string]: unknown }[], decimals: number) {
  return JSON.stringify(rows.map((row) => ({ ...row, ...(row.amount !== undefined ? { amount: formatUnits(BigInt(row.amount), decimals) } : {}) })), (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2);
}

export type TransactionIntent={from:string;to:string|null;input:string;value:string;nonce:number};
export function recoveredOutcome(intent:TransactionIntent, actual:{from:string;to:string|null;input:string;value:bigint;nonce:number},status:string){
 if(actual.from.toLowerCase()!==intent.from.toLowerCase())throw new Error('Replacement sender does not match the original wallet.');
 if(actual.nonce!==intent.nonce)throw new Error('Replacement nonce does not match the recorded transaction.');
 if(status!=='success')return 'reverted' as const;
 if(actual.to?.toLowerCase()===intent.to?.toLowerCase()&&actual.input.toLowerCase()===intent.input.toLowerCase()&&actual.value===BigInt(intent.value))return 'confirmed' as const;
 if(actual.to?.toLowerCase()===intent.from.toLowerCase()&&actual.input==='0x'&&actual.value===0n)return 'cancelled' as const;
 return 'replaced' as const;
}
