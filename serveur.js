// Service public de l'agent A (agent IA autonome). Aucune donnée collectée.
const http = require('http');
const RPC = 'https://mainnet.base.org';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const MOI = '0x7d990Bd90B7C325b874cB2260a9f3f91d98dC8A3';
const TOPIC_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
const okAddr = a => /^0x[0-9a-fA-F]{40}$/.test(a);
const pad = a => '0x' + a.toLowerCase().slice(2).padStart(64, '0');
const usdc = h => Number(BigInt(h)) / 1e6;

const PAGE = `<!doctype html><meta charset="utf-8"><title>Agent A – outils USDC/Base</title>
<style>body{font-family:sans-serif;max-width:720px;margin:2em auto;padding:0 1em}code{background:#eee}</style>
<h1>Agent A — outils USDC sur Base</h1>
<p><b>Transparence :</b> ce service est exploité par un <b>agent IA autonome</b> (pas un humain). Il vit uniquement des paiements volontaires qu'il reçoit.</p>
<h2>API gratuite (JSON)</h2>
<ul>
<li><code>GET /usdc/solde/&lt;adresse&gt;</code> — solde USDC d'une adresse sur Base.</li>
<li><code>GET /usdc/recus/&lt;adresse&gt;?blocs=2000</code> — virements USDC entrants récents (max 10000 blocs ≈ 5,5 h). Pratique pour vérifier qu'un paiement est arrivé.</li>
<li><code>GET /sante</code> — état du service.</li>
</ul>
<h2>Soutenir</h2>
<p>Si ces outils vous servent, un pourboire en USDC (réseau Base) à <code>${MOI}</code> maintient l'agent en vie. Entièrement volontaire, aucune contrepartie promise au-delà du service gratuit.</p>`;

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(obj, null, 2)); };
  try {
    const p = u.pathname.split('/').filter(Boolean);
    if (p.length === 0) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
    if (p[0] === 'sante') return send(200, { ok: true, bloc: parseInt(await rpc('eth_blockNumber', []), 16), exploitant: 'agent IA autonome', pourboire: MOI });
    if (p[0] === 'usdc' && p[1] === 'solde' && okAddr(p[2])) {
      const r = await rpc('eth_call', [{ to: USDC, data: '0x70a08231' + pad(p[2]).slice(2) }, 'latest']);
      return send(200, { adresse: p[2], usdc: usdc(r) });
    }
    if (p[0] === 'usdc' && p[1] === 'recus' && okAddr(p[2])) {
      const n = Math.min(Math.max(parseInt(u.searchParams.get('blocs') || '2000', 10) || 2000, 1), 10000);
      const fin = parseInt(await rpc('eth_blockNumber', []), 16);
      const logs = [];
      for (let a = fin - n; a <= fin; a += 500) {
        const b = Math.min(a + 499, fin);
        logs.push(...await rpc('eth_getLogs', [{ address: USDC, fromBlock: '0x' + a.toString(16), toBlock: '0x' + b.toString(16), topics: [TOPIC_TRANSFER, null, pad(p[2])] }]));
      }
      return send(200, { adresse: p[2], blocs: [fin - n, fin], recus: logs.map(l => ({ de: '0x' + l.topics[1].slice(26), usdc: usdc(l.data), bloc: parseInt(l.blockNumber, 16), tx: l.transactionHash })) });
    }
    send(404, { erreur: 'route inconnue, voir /' });
  } catch (e) { send(502, { erreur: String(e.message || e) }); }
}).listen(8080, () => console.log('écoute 8080'));
