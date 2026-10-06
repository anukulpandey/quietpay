import { validAddress } from '../lib/address';
import { readSavedAddress } from './artifacts';

const address = import.meta.env.VITE_EERC_ADDRESS?.trim() || readSavedAddress() || '';
const base = (import.meta.env.VITE_CIRCUIT_BASE_URL?.trim() || '/circuits').replace(/\/$/, '');
export const liveConfig = {
  address: validAddress(address) ? address as `0x${string}` : undefined,
  circuitBase: base,
  // These are the filenames QuietPay expects. Copy artifacts from the exact contract deployment.
  circuits: {
    register: { wasm: `${base}/RegistrationCircuit.wasm`, zkey: `${base}/RegistrationCircuit.zkey` },
    transfer: { wasm: `${base}/TransferCircuit.wasm`, zkey: `${base}/TransferCircuit.zkey` },
    mint: { wasm: `${base}/MintCircuit.wasm`, zkey: `${base}/MintCircuit.zkey` },
    withdraw: { wasm: `${base}/WithdrawCircuit.wasm`, zkey: `${base}/WithdrawCircuit.zkey` },
    burn: { wasm: `${base}/BurnCircuit.wasm`, zkey: `${base}/BurnCircuit.zkey` },
  },
};
export const liveConfigured = Boolean(liveConfig.address && base && (base.startsWith('/') || base.startsWith('https://') || base.startsWith('http://localhost:')));
