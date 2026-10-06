import { createPublicClient, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
export const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(undefined, {timeout:15000,retryCount:1}), pollingInterval:4000 });
export const chainId = avalancheFuji.id;
