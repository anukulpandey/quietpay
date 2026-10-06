import type { Abi, Address, Hex } from 'viem';
export const deploymentSteps = ['RegistrationVerifier','MintVerifier','WithdrawVerifier','TransferVerifier','BurnVerifier','BabyJubJub','Registrar','EncryptedERC'] as const;
export type DeploymentStep = typeof deploymentSteps[number];
type Slot = { start: number; length: number };
export type Artifact = { abi: Abi; bytecode: string; linkReferences: Record<string,Record<string,Slot[]>>; runtimeBytecode: Hex; runtimeLinkReferences: Artifact['linkReferences']; immutableReferences: Record<string,Slot[]> };
export type DeploymentManifest = { commit: string; chainId: number; compiler: string; artifacts: Record<DeploymentStep,Artifact>; circuits: Record<string,{bytes:number;sha256:string}> };
export type DeployedContracts = Partial<Record<DeploymentStep,Address>>;
export function linkBytecode(artifact: Pick<Artifact,'bytecode'|'linkReferences'>, contracts: Record<string,Address|undefined>): Hex {
 let code = artifact.bytecode.slice(2);
 for (const libraries of Object.values(artifact.linkReferences)) for (const [name,slots] of Object.entries(libraries)) {
  const address=contracts[name]; if (!address) throw new Error(`Missing library ${name}`);
  for (const {start,length} of slots) { if(length!==20) throw new Error('Invalid link length'); code=code.slice(0,start*2)+address.slice(2).toLowerCase()+code.slice((start+length)*2); }
 }
 if (!/^[0-9a-fA-F]+$/.test(code)) throw new Error('Unresolved bytecode links');
 return `0x${code}`;
}
export function deploymentArgs(step:DeploymentStep, contracts:DeployedContracts): readonly unknown[] {
 const required=(name:DeploymentStep)=>{ const address=contracts[name]; if(!address) throw new Error(`Missing ${name} deployment`); return address; };
 if(step==='Registrar') return [required('RegistrationVerifier')];
 if(step==='EncryptedERC') return [{ registrar:required('Registrar'),isConverter:false,name:'QuietPay Test',symbol:'QTEST',decimals:6,mintVerifier:required('MintVerifier'),withdrawVerifier:required('WithdrawVerifier'),transferVerifier:required('TransferVerifier'),burnVerifier:required('BurnVerifier') }];
 return [];
}
export function matchesRuntime(actual:string, expected:string, immutable:Record<string,Slot[]>):boolean {
 if (actual.length!==expected.length || actual==='0x') return false;
 const normalize=(value:string)=>{let result=value.slice(2).toLowerCase();for(const slots of Object.values(immutable))for(const {start,length} of slots)result=result.slice(0,start*2)+'0'.repeat(length*2)+result.slice((start+length)*2);return result;};
 return normalize(actual)===normalize(expected);
}
export function runtimeForDeployment(step:DeploymentStep, artifact:Artifact, contracts:DeployedContracts, address:Address):Hex {
 let runtime=linkBytecode({bytecode:artifact.runtimeBytecode,linkReferences:artifact.runtimeLinkReferences},contracts);
 // Solidity libraries embed their own deployed address after the opening PUSH20.
 if(step==='BabyJubJub' && runtime.startsWith('0x73'+'0'.repeat(40)))runtime=`0x73${address.slice(2)}${runtime.slice(44)}`;
 return runtime;
}
