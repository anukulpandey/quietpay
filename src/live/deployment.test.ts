import { describe, expect, it } from 'vitest';
import { linkBytecode, deploymentArgs, deploymentSteps, matchesRuntime } from './deployment';
const address = '0x1111111111111111111111111111111111111111' as const;
describe('official contract deployment', () => {
 it('links only the exact library slots declared by the Solidity compiler', () => {
   expect(linkBytecode({bytecode:`0x6000${'_'.repeat(40)}61`,linkReferences:{'lib.sol':{BabyJubJub:[{start:2,length:20}]}}}, {BabyJubJub:address})).toBe(`0x6000${address.slice(2)}61`);
 });
 it('refuses unresolved library references', () => {
   expect(()=>linkBytecode({bytecode:`0x${'_'.repeat(40)}`,linkReferences:{'lib.sol':{BabyJubJub:[{start:0,length:20}]}}}, {})).toThrow(/Missing library/);
 });
 it('deploys the official verifier suite before the registrar and token', () => {
   expect(deploymentSteps.at(-1)).toBe('EncryptedERC');
   expect(()=>deploymentArgs('EncryptedERC', {})).toThrow(/Missing/);
   const contracts=Object.fromEntries(deploymentSteps.map(name=>[name,address]));
   expect(deploymentArgs('EncryptedERC',contracts)).toEqual([expect.objectContaining({registrar:address,isConverter:false,decimals:6,name:'QuietPay Test',symbol:'QTEST',burnVerifier:address})]);
 });
 it('compares deployed code while allowing only compiler-declared immutable slots',()=>{
  expect(matchesRuntime('0x6000112261','0x6000ffff61',{'1':[{start:2,length:2}]})).toBe(true);
  expect(matchesRuntime('0x6100112261','0x6000ffff61',{'1':[{start:2,length:2}]})).toBe(false);
  expect(matchesRuntime('0x','0x6000',{})).toBe(false);
 });
});
