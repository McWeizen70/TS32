// Cloudflare Worker: nimmt das Ergebnis der Messübung entgegen und legt es als Datei im GitHub-Repo ab.
// Einrichtung: siehe worker/README.md
//
// Secret:   GITHUB_TOKEN   (fine-grained Token, nur Repo TS32, Berechtigung „Contents: Read and write“)
// Variablen (optional, sonst Standardwerte):
//   REPO            Standard: McWeizen70/TS32
//   BRANCH          Standard: main
//   ALLOWED_ORIGIN  Standard: https://mcweizen70.github.io
//   TARGET_DIR      Standard: eingang

const MAX_BYTES = 20000;

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || 'https://mcweizen70.github.io';
    const cors = {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    const reply = (status, obj) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' });
    if (request.headers.get('Origin') !== allowed) return reply(403, { ok: false, error: 'origin' });

    const raw = await request.text();
    if (raw.length > MAX_BYTES) return reply(413, { ok: false, error: 'size' });

    let data;
    try { data = clean(JSON.parse(raw)); } catch { data = null; }
    if (!data) return reply(400, { ok: false, error: 'format' });

    const repo = env.REPO || 'McWeizen70/TS32';
    const branch = env.BRANCH || 'main';
    const dir = env.TARGET_DIR || 'eingang';
    const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); // JJJJ-MM-TT
    const rnd = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('');
    const path = `${dir}/${day}/gruppe-${data.gruppe}-${rnd}.json`;

    const body = JSON.stringify(data, null, 1) + '\n';
    const content = btoa(Array.from(new TextEncoder().encode(body), b => String.fromCharCode(b)).join(''));

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ts32-upload-worker',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: `Messübung Gruppe ${data.gruppe} (${day})`, content, branch })
    });
    if (!res.ok) return reply(502, { ok: false, error: 'github' });
    return reply(200, { ok: true });
  }
};

// Prüft das Ergebnis und baut es neu auf – unbekannte Felder (z. B. Namen) werden verworfen.
function clean(p) {
  const isNum = (x, lo, hi) => typeof x === 'number' && isFinite(x) && x >= lo && x <= hi;
  const numOrNull = (x, lo, hi) => (x === null ? null : isNum(x, lo, hi) ? x : undefined);
  if (!p || p.format !== 'ts32-laerm' || p.version !== 2) return null;
  if (!Number.isInteger(p.gruppe) || p.gruppe < 1 || p.gruppe > 99) return null;
  if (p.modus !== 'gruppe' && p.modus !== 'einzelperson') return null;
  if (!Array.isArray(p.taetigkeiten) || p.taetigkeiten.length < 1 || p.taetigkeiten.length > 10) return null;
  const taetigkeiten = [];
  for (const t of p.taetigkeiten) {
    if (!t || typeof t.name !== 'string' || t.name.length > 80) return null;
    if (!Array.isArray(t.stichproben) || t.stichproben.length > 20 || !t.stichproben.every(x => isNum(x, 0, 160))) return null;
    const laeq = numOrNull(t.laeq, 0, 160);
    if (laeq === undefined) return null;
    if (!Number.isInteger(t.h) || t.h < 0 || t.h > 24 || !Number.isInteger(t.min) || t.min < 0 || t.min > 59) return null;
    taetigkeiten.push({ name: t.name, stichproben: t.stichproben, laeq, h: t.h, min: t.min });
  }
  const lex = numOrNull(p.lex, 0, 160);
  if (lex === undefined) return null;
  return { format: 'ts32-laerm', version: 2, gruppe: p.gruppe, modus: p.modus, taetigkeiten, lex };
}
