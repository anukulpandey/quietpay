export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function validAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/.test(address);
}
