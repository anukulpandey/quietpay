import { parseUnits } from 'viem';

export function parseLiveAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported token precision.');
  if (!/^\d{1,12}(\.\d+)?$/.test(value) || (value.split('.')[1]?.length ?? 0) > decimals) throw new Error(`Enter a positive amount with at most ${decimals} decimal places.`);
  const amount = parseUnits(value, decimals);
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');
  return amount;
}
