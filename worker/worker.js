// Cloudflare Worker für die Messübung:
//   POST  nimmt das Ergebnis der Messübung entgegen und legt es als Datei im GitHub-Repo ab.
//   GET   ?datum=JJJJ-MM-TT liefert alle Ergebnisse dieses Tages (für auswertung.html). Der Worker fragt GitHub
//         mit dem Token ab und umgeht so das Abruflimit für nicht angemeldete Abrufe (60 pro Stunde und IP-Adresse).
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
    if (request.method === 'GET') return listDay(new URL(request.url), env);
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
    const time = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Europe/Berlin' }).replace(/:/g, ''); // HHMMSS: Dateinamen sortieren zeitlich
    const rnd = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('');
    const path = `${dir}/${day}/gruppe-${data.gruppe}-${time}-${rnd}.json`;

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

// Alle Ergebnisse eines Tages aus eingang/<Datum> liefern. Die Daten sind öffentlich (öffentliches Repo), daher für jede Herkunft lesbar;
// ausgegeben wird nur, was die Prüfung unten besteht.
async function listDay(url, env) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers });
  const datum = url.searchParams.get('datum') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return reply(400, { ok: false, error: 'datum' });

  const repo = env.REPO || 'McWeizen70/TS32';
  const branch = env.BRANCH || 'main';
  const base = `https://api.github.com/repos/${repo}/contents/${env.TARGET_DIR || 'eingang'}/${datum}`;
  const gh = accept => ({
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': accept,
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ts32-upload-worker'
  });

  const res = await fetch(`${base}?ref=${branch}`, { headers: gh('application/vnd.github+json') });
  if (res.status === 404) return reply(200, { ok: true, datum, dateien: [] });
  if (!res.ok) return reply(502, { ok: false, error: 'github', status: res.status });

  // nach Gruppe und Dateiname sortieren: bei mehrfacher Sendung steht die zuletzt gesendete hinten
  const parts = n => /^gruppe-(\d+)-(.*)\.json$/.exec(n);
  const names = (await res.json()).filter(f => f.type === 'file' && parts(f.name)).map(f => f.name)
    .sort((a, b) => { const [, na, ra] = parts(a), [, nb, rb] = parts(b); return (na - nb) || (ra < rb ? -1 : ra > rb ? 1 : 0); })
    .slice(0, 40); // Grenze für Unteranfragen im kostenlosen Tarif (50)

  const dateien = await Promise.all(names.map(async name => {
    const r = await fetch(`${base}/${encodeURIComponent(name)}?ref=${branch}`, { headers: gh('application/vnd.github.raw+json') });
    if (!r.ok) return null;
    try { const daten = clean(JSON.parse(await r.text())); return daten ? { name, daten } : null; } catch { return null; }
  }));
  return reply(200, { ok: true, datum, dateien: dateien.filter(Boolean) });
}

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
