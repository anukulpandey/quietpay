import { expect, it } from 'vitest';
import { validateBatch, executeLiveBatch, type LivePayment } from './batch';
const sender='0x1111111111111111111111111111111111111111';
const a='0x2222222222222222222222222222222222222222';
const b='0x3333333333333333333333333333333333333333';
const rows:LivePayment[]=[{id:'a',to:a,amount:'1.25',status:'ready'},{id:'b',to:b,amount:'2',status:'ready'}];
it('validates a reviewed batch with exact token precision and wallet destinations',()=>{
 expect(validateBatch(rows,sender,6,3250000n)).toBe(3250000n);
 expect(()=>validateBatch(rows,sender,6,3249999n)).toThrow(/balance/);
 expect(()=>validateBatch([rows[0],{...rows[1],to:a}],sender,6,5000000n)).toThrow(/Duplicate/);
 expect(()=>validateBatch([{...rows[0],to:sender}],sender,6,5000000n)).toThrow(/your own/);
 expect(()=>validateBatch([{...rows[0],amount:'0.0000001'}],sender,6,5000000n)).toThrow();
});
it('halts after uncertain broadcast and never resends a confirmed row on retry',async()=>{
 const input=[{...rows[0],status:'confirmed' as const,hash:`0x${'a'.repeat(64)}` as const},rows[1]];
 let sends=0;let latest:LivePayment[]=[];
 const stopped=await executeLiveBatch(input,async()=>{sends++;throw new Error('RPC timed out after submission');},r=>latest=r);
 expect(sends).toBe(1);expect(stopped[0].status).toBe('confirmed');expect(stopped[1].status).toBe('paused');expect(latest).toEqual(stopped);
});
it('confirms each row only after the send function returns a confirmed receipt hash',async()=>{
 const transitions:string[]=[];
 const result=await executeLiveBatch(rows,async()=>`0x${'b'.repeat(64)}`,r=>transitions.push(r.map(x=>x.status).join(',')));
 expect(transitions).toEqual(['submitting,ready','confirmed,ready','confirmed,submitting','confirmed,confirmed']);
 expect(result.every(r=>r.status==='confirmed')).toBe(true);
});
