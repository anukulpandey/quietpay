import './browser';
import { EERC } from '@avalabs/eerc-sdk';
import { parseAbi, parseAbiItem, type Abi, type Address, type WalletClient } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { liveConfig } from './config';
import type { TransactionIntent } from './transactions';
import { journalWallet } from './journalWallet';

import { publicClient } from './chain';
import { verifyCircuitAssets } from './artifacts';
import { verifyStandaloneDeployment } from './verify';
export { publicClient } from './chain';
const metadataAbi = parseAbi([
  'function registrar() view returns (address)',
  'function isConverter() view returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function owner() view returns (address)',
  'function auditor() view returns (address)',
  'function auditorPublicKey() view returns (uint256 x, uint256 y)',
]);
export type LiveSession = { sdk: EERC; decimals: number; symbol: string; owner: Address; registrar: Address };

export async function createSession(wallet: WalletClient, beforeSend?: (intent: TransactionIntent) => void): Promise<LiveSession> {
  if (!liveConfig.address) throw new Error('Configure the eERC contract first.');
  if (await wallet.getChainId() !== avalancheFuji.id) throw new Error('Switch to Avalanche Fuji.');
  const bytecode = await publicClient.getCode({ address: liveConfig.address });
  if (!bytecode || bytecode === '0x') throw new Error('No contract found at the configured Fuji address.');
  const contract = { address: liveConfig.address, abi: metadataAbi };
  const [registrar, isConverter, decimals, symbol, owner] = await Promise.all([
    publicClient.readContract({ ...contract, functionName: 'registrar' }),
    publicClient.readContract({ ...contract, functionName: 'isConverter' }),
    publicClient.readContract({ ...contract, functionName: 'decimals' }),
    publicClient.readContract({ ...contract, functionName: 'symbol' }),
    publicClient.readContract({ ...contract, functionName: 'owner' }),
  ]);
  await verifyStandaloneDeployment(publicClient, liveConfig.address);
  await verifyCircuitAssets(liveConfig.circuitBase);
  if (isConverter) throw new Error('This first build supports standalone eERC test tokens. Configure a standalone deployment.');
  if (decimals > 18) throw new Error('This token uses unsupported precision.');
  const signer = beforeSend ? journalWallet(publicClient, wallet, beforeSend) : wallet;
  return { sdk: new EERC(publicClient, signer, liveConfig.address, registrar, false, liveConfig.circuits), decimals, symbol, owner, registrar };
}

export async function readPrivateBalance(session: LiveSession, address: Address, minimumBlock = 0n) {
  const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
  const blockNumber = latest > minimumBlock ? latest : minimumBlock;
  const sdk = session.sdk;
  const raw = await publicClient.readContract({ address: sdk.contractAddress, abi: sdk.encryptedErcAbi as Abi, functionName: 'balanceOf', args: [address, 0n], blockNumber }) as [Parameters<EERC['calculateTotalBalance']>[0], unknown, Parameters<EERC['calculateTotalBalance']>[1], bigint[]];
  const decrypted = sdk.calculateTotalBalance(raw[0], raw[2], raw[3]);
  if (decrypted < 0n) throw new Error('Encrypted balance integrity check failed. Unlock with the registered wallet key.');
  return { decrypted, encrypted: [raw[0].c1.x, raw[0].c1.y, raw[0].c2.x, raw[0].c2.y] };
}

export async function readAuditor(session: LiveSession) {
  const contract = { address: session.sdk.contractAddress, abi: metadataAbi };
  const [address, key] = await Promise.all([
    publicClient.readContract({ ...contract, functionName: 'auditor' }),
    publicClient.readContract({ ...contract, functionName: 'auditorPublicKey' }),
  ]);
  return { address, key: [...key] };
}

export async function readRecentAudit(session: LiveSession, address: Address) {
  const toBlock = await publicClient.getBlockNumber();
  const fromBlock = toBlock > 999n ? toBlock - 999n : 0n;
  // SDK 1.0.2's auditorDecrypt wrongly requires a recent AuditorChanged event.
  // Verify the current auditor independently and use the SDK only for decryption.
  const auditor = await readAuditor(session);
  if (auditor.address.toLowerCase() !== address.toLowerCase() || auditor.key[0] !== session.sdk.publicKey[0] || auditor.key[1] !== session.sdk.publicKey[1]) throw new Error('Connect and unlock the designated auditor wallet.');
  const events = [
    parseAbiItem('event PrivateTransfer(address indexed from, address indexed to, uint256[7] auditorPCT, address indexed auditorAddress)'),
    parseAbiItem('event PrivateMint(address indexed user, uint256[7] auditorPCT, address indexed auditorAddress)'),
    parseAbiItem('event PrivateBurn(address indexed user, uint256[7] auditorPCT, address indexed auditorAddress)'),
  ];
  const logs = (await Promise.all(events.map((event) => publicClient.getLogs({ address: session.sdk.contractAddress, event, args: { auditorAddress: address }, fromBlock, toBlock, strict: true })))).flat();
  return logs.sort((a, b) => a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1).map((log) => {
    const common = { type: log.eventName, transactionHash: log.transactionHash, blockNumber: log.blockNumber };
    try { return { ...common, amount: session.sdk.decryptPCT([...log.args.auditorPCT]).toString() }; }
    catch { return { ...common, error: 'Cannot decrypt with the current auditor key.' }; }
  });
}
