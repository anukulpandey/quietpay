// Ephemeral local EVM for browser-proof acceptance. These publicly known fixture
// keys must NEVER be funded outside this isolated chain. No real wallets used.
import ganache from 'ganache';
const accounts=[1,2,3].map(n=>({secretKey:`0x${n.toString(16).padStart(64,'0')}`,balance:'0x56bc75e2d63100000'}));
const server=ganache.server({chain:{chainId:43113,hardfork:'shanghai'},wallet:{accounts},logging:{quiet:true}});
await server.listen(8547,'127.0.0.1');
console.log('Isolated browser-test RPC: http://127.0.0.1:8547. Fixture accounts only.');
process.on('SIGTERM',()=>server.close());
process.on('SIGINT',()=>server.close());
