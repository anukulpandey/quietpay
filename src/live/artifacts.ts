import { getAddress, type Address } from 'viem';
import type { DeploymentManifest } from './deployment';
export const upstreamCommit = '8dc98cd4d63ad3aa6d86b70b8f4bbcd70f1e8be1';
let manifestPromise:Promise<DeploymentManifest>|undefined;
export async function loadManifest():Promise<DeploymentManifest> {
 if(!manifestPromise) manifestPromise=fetch('/deployment/manifest.json').then(async response=>{
  if(!response.ok)throw new Error('Deployment bundle is missing. Run npm run chain:prepare.');
  const manifest=await response.json() as DeploymentManifest;
  if(manifest.commit!==upstreamCommit || manifest.chainId!==43113)throw new Error('Deployment bundle does not match this build.');
  return manifest;
 }).catch(error=>{manifestPromise=undefined;throw error;});
 return manifestPromise;
}
const verified=new Map<string,Promise<void>>();
export function verifyCircuitAssets(base:string):Promise<void>{
 if(!verified.has(base))verified.set(base,(async()=>{
  const manifest=await loadManifest();
  // Verify all enabled proof types against the pinned official verifier build.
  for(const [name,expected] of Object.entries(manifest.circuits)){
   if(!/^(Registration|Transfer|Mint)Circuit\./.test(name))continue;
   const response=await fetch(`${base}/${name}`);
   if(!response.ok)throw new Error(`Cannot load ${name}. Check the proof asset host.`);
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength!==expected.bytes)throw new Error(`Unexpected size for ${name}. Use the bundled proof files.`);
   const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(digest!==expected.sha256)throw new Error(`Proof integrity check failed for ${name}.`);
  }
 })().catch(error=>{verified.delete(base);throw error;}));
 return verified.get(base)!;
}
export const activeDeploymentKey='quietpay.deployment.43113.active';
export function readSavedAddress():Address|undefined{
 try{const saved=JSON.parse(localStorage.getItem(activeDeploymentKey)||'null');return saved?.chainId===43113&&saved?.commit===upstreamCommit?getAddress(saved.address):undefined;}catch{return undefined;}
}
export function activateDeployment(address:Address){
 localStorage.setItem(activeDeploymentKey,JSON.stringify({chainId:43113,address:getAddress(address),commit:upstreamCommit}));
}
