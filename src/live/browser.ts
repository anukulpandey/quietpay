import { Buffer } from 'buffer';

// The official SDK's blake-hash dependency accesses Buffer while its module loads.
// Load this shim before the SDK, only in the lazy-loaded live workspace.
globalThis.Buffer ??= Buffer;
