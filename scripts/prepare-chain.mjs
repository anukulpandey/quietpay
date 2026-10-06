import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import solc from 'solc';

const root = path.resolve(import.meta.dirname, '..');
const provenance = JSON.parse(fs.readFileSync(path.join(root, 'vendor/encrypted-erc/UPSTREAM.json'), 'utf8'));
const contracts = path.join(root, 'vendor/encrypted-erc');
const entries = ['RegistrationVerifier', 'MintVerifier', 'WithdrawVerifier', 'TransferVerifier', 'BurnVerifier'].map(name => [`contracts/prod/${name}.sol`, name]);
entries.push(['contracts/libraries/BabyJubJub.sol', 'BabyJubJub'], ['contracts/Registrar.sol', 'Registrar'], ['contracts/EncryptedERC.sol', 'EncryptedERC']);
const sources = Object.fromEntries(entries.map(([file]) => [file, { content: fs.readFileSync(path.join(contracts, file), 'utf8') }]));
const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.bytecode.linkReferences', 'evm.deployedBytecode.object', 'evm.deployedBytecode.immutableReferences', 'evm.deployedBytecode.linkReferences'] } } } }), { import: file => {
  try { return { contents: fs.readFileSync(path.join(file.startsWith('@') ? path.join(root, 'node_modules') : contracts, file), 'utf8') }; }
  catch { return { error: `Missing dependency ${file}` }; }
} }));
for (const error of output.errors ?? []) if (error.severity === 'error') throw new Error(error.formattedMessage);
const artifacts = Object.fromEntries(entries.map(([file, name]) => {
  const contract = output.contracts[file][name];
  return [name, { abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}`, linkReferences: contract.evm.bytecode.linkReferences, runtimeBytecode: `0x${contract.evm.deployedBytecode.object}`, immutableReferences: contract.evm.deployedBytecode.immutableReferences, runtimeLinkReferences: contract.evm.deployedBytecode.linkReferences }];
}));
const circuitNames = ['RegistrationCircuit', 'MintCircuit', 'TransferCircuit', 'WithdrawCircuit', 'BurnCircuit'];
const files = Object.fromEntries(circuitNames.flatMap(name => ['wasm','zkey'].map(ext => {
  const file = `${name}.${ext}`; const data = fs.readFileSync(path.join(root,'public/circuits',file));
  return [file,{ bytes:data.length, sha256:crypto.createHash('sha256').update(data).digest('hex') }];
})));
fs.writeFileSync(path.join(root,'public/deployment/manifest.json'),JSON.stringify({ ...provenance, compiler:solc.version(), artifacts, circuits:files }));
console.log(`Compiled ${entries.length} official contracts; hashed ${Object.keys(files).length} matching proof assets.`);
