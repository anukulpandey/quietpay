import { describe, expect, it } from 'vitest';
import { confirmationOutcome, serializeAudit } from './transactions';

describe('live confirmation integrity', () => {
  it('does not report a successful cancellation or replacement as the original payment', () => {
    expect(confirmationOutcome('success', 'cancelled')).toBe('cancelled');
    expect(confirmationOutcome('success', 'replaced')).toBe('replaced');
    expect(confirmationOutcome('success', 'repriced')).toBe('confirmed');
    expect(confirmationOutcome('reverted', 'repriced')).toBe('reverted');
  });
  it('renders SDK auditor results containing bigint block numbers', () => {
    const json = serializeAudit([{ type: 'PrivateTransfer', amount: '1234', blockNumber: 25000n }], 2);
    expect(JSON.parse(json)).toEqual([{ type: 'PrivateTransfer', amount: '12.34', blockNumber: '25000' }]);
  });
});

import { recoveredOutcome } from './transactions';
const intent={from:'0x1111111111111111111111111111111111111111',to:'0x2222222222222222222222222222222222222222',input:'0x1234',value:'0',nonce:7} as const;
it('recovers only the same sender and nonce, without treating a changed call as a payment',()=>{
 expect(recoveredOutcome(intent,{...intent,value:0n},'success')).toBe('confirmed');
 expect(recoveredOutcome(intent,{...intent,value:0n,input:'0xabcd'},'success')).toBe('replaced');
 expect(recoveredOutcome(intent,{...intent,value:0n,to:intent.from,input:'0x'},'success')).toBe('cancelled');
 expect(()=>recoveredOutcome(intent,{...intent,value:0n,nonce:8},'success')).toThrow(/nonce/);
 expect(()=>recoveredOutcome(intent,{...intent,value:0n,from:intent.to},'success')).toThrow(/sender/);
 expect(recoveredOutcome(intent,{...intent,value:0n},'reverted')).toBe('reverted');
});
