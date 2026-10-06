import { describe, expect, it } from 'vitest';
import { parseLiveAmount } from './amount';

describe('contract token decimals', () => {
  it('uses the deployed eERC precision, including two-decimal tokens', () => {
    expect(parseLiveAmount('12.34', 2)).toBe(1234n);
    expect(parseLiveAmount('1.000001', 6)).toBe(1000001n);
  });
  it('never silently rounds a live payment', () => {
    expect(() => parseLiveAmount('1.234', 2)).toThrow();
    expect(() => parseLiveAmount('0', 2)).toThrow();
    expect(() => parseLiveAmount('1e3', 2)).toThrow();
    expect(() => parseLiveAmount('-5', 2)).toThrow();
  });
});
