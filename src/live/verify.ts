import { getAddress, parseAbi, type Address, type PublicClient } from 'viem';
import { loadManifest } from './artifacts';
import { matchesRuntime, runtimeForDeployment, type DeployedContracts, type DeploymentManifest } from './deployment';
export async function verifyStandaloneDeployment(client:PublicClient,address:Address,provided?:DeploymentManifest){
 if(await client.getChainId()!==43113)throw new Error('Deployment verification requires Avalanche Fuji.');
 const manifest=provided??await loadManifest();
 const abi=parseAbi(['function registrar() view returns (address)','function isConverter() view returns (bool)','function mintVerifier() view returns (address)','function transferVerifier() view returns (address)','function burnVerifier() view returns (address)','function withdrawVerifier() view returns (address)']);
 const contract={address,abi};
 const [registrar,converter,mint,transfer,burn,withdraw]=await Promise.all([
  client.readContract({...contract,functionName:'registrar'}),client.readContract({...contract,functionName:'isConverter'}),client.readContract({...contract,functionName:'mintVerifier'}),client.readContract({...contract,functionName:'transferVerifier'}),client.readContract({...contract,functionName:'burnVerifier'}),client.readContract({...contract,functionName:'withdrawVerifier'}),
 ]);
 if(converter)throw new Error('QuietPay currently supports standalone private tokens.');
 const registration=await client.readContract({address:registrar,abi:parseAbi(['function registrationVerifier() view returns (address)']),functionName:'registrationVerifier'});
 const code=await client.getCode({address});if(!code||code==='0x')throw new Error('No deployed token found at this address.');
 const links=manifest.artifacts.EncryptedERC.runtimeLinkReferences;
 const slot=Object.values(links).flatMap(libraries=>libraries.BabyJubJub??[])[0];
 if(!slot||slot.length!==20)throw new Error('Missing library metadata in the deployment bundle.');
 const babyJub=getAddress(`0x${code.slice(2+slot.start*2,2+(slot.start+20)*2)}`);
 const contracts:DeployedContracts={EncryptedERC:address,Registrar:registrar,RegistrationVerifier:registration,MintVerifier:mint,TransferVerifier:transfer,BurnVerifier:burn,WithdrawVerifier:withdraw,BabyJubJub:babyJub};
 for(const [name,deployed] of Object.entries(contracts)){
  const step=name as keyof DeployedContracts;const artifact=manifest.artifacts[step];
  const actual=step==='EncryptedERC'?code:await client.getCode({address:deployed});
  if(!actual||!matchesRuntime(actual,runtimeForDeployment(step,artifact,contracts,deployed),artifact.immutableReferences))throw new Error(`${name} is not the official build bundled with QuietPay. Check the contract address.`);
 }
 return contracts;
}
