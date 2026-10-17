// Gemeinsame Funktionen für auswertung.html und langzeit.html:
// Einlesen und Prüfen der Ergebnisse, Statistik, Diagramme (SVG) und Präsentationsmodus.
'use strict';

const TS32 = (() => {
  const LOW = 80, HIGH = 85;

  // ---------- Formatierung ----------
  const f1 = x => (typeof x === 'number' && isFinite(x) ? x.toFixed(1).replace('.', ',') : '–');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const datumDE = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso || ''); };

  // ---------- Statistik ----------
  const leq = v => 10 * Math.log10(v.reduce((a, l) => a + Math.pow(10, 0.1 * l), 0) / v.length); // energetischer Mittelwert
  const sdev = v => { const n = v.length; if (n < 2) return NaN; const m = v.reduce((a, b) => a + b, 0) / n; return Math.sqrt(v.reduce((a, l) => a + (l - m) ** 2, 0) / (n - 1)); };
  function stats(vals) {
    const v = vals.filter(x => typeof x === 'number' && isFinite(x));
    if (!v.length) return null;
    const mn = Math.min(...v), mx = Math.max(...v);
    return { mn, mx, range: mx - mn, mean: leq(v), sd: sdev(v), n: v.length };
  }

  // ---------- Einlesen und Prüfen ----------
  // Zahl übernehmen; alles andere wird zu null
  function toNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v.replace(',', '.')); return isFinite(x) ? x : null; }
    return null;
  }
  // Gruppenergebnis prüfen und in sichere Form bringen. Personenbezogene Felder (z. B. "namen" aus alten Codes) werden verworfen.
  function normalizeGroup(o) {
    if (!o || typeof o !== 'object' || o.format !== 'ts32-laerm' || !Array.isArray(o.taetigkeiten)) return null;
    const gruppe = toNum(o.gruppe);
    if (!Number.isInteger(gruppe) || gruppe < 1 || gruppe > 999) return null;
    const taetigkeiten = [];
    for (const t of o.taetigkeiten) {
      if (!t || typeof t !== 'object' || typeof t.name !== 'string') return null;
      taetigkeiten.push({
        name: t.name.slice(0, 80),
        stichproben: Array.isArray(t.stichproben) ? t.stichproben.map(toNum).filter(v => v !== null) : [],
        laeq: toNum(t.laeq), h: Math.max(0, toNum(t.h) || 0), min: Math.max(0, toNum(t.min) || 0)
      });
    }
    return { format: 'ts32-laerm', gruppe, modus: o.modus === 'gruppe' ? 'gruppe' : 'einzelperson', taetigkeiten, lex: toNum(o.lex) };
  }
  // Seminar-Archivdatei prüfen
  function normalizeSeminar(o, quelle) {
    if (!o || typeof o !== 'object' || o.format !== 'ts32-seminar' || !Array.isArray(o.gruppen)) return null;
    const datum = /^\d{4}-\d{2}-\d{2}$/.test(o.datum) ? o.datum : null;
    if (!datum) return null;
    const gruppen = o.gruppen.map(normalizeGroup).filter(Boolean);
    return { datum, quelle: quelle || '', gruppen };
  }
  function seminarFile(datum, gruppen) {
    return { format: 'ts32-seminar', version: 1, datum, gruppen: gruppen.map(g => normalizeGroup(g)).filter(Boolean) };
  }
  // Base64 → Text (UTF-8); wirft bei ungültigen Daten
  function b64text(b64) {
    const bin = atob(b64);
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }
  // Code dekodieren; hängt Text direkt am Code (z. B. eine Signatur), wird von hinten gekürzt, bis gültiges JSON übrig bleibt
  function decodeCode(b64) {
    for (let len = b64.length - (b64.length % 4); len >= 8; len -= 4) {
      try { return JSON.parse(b64text(b64.slice(0, len))); } catch { /* weiter kürzen */ }
    }
    throw new Error('ungültig');
  }
  // alle Codes aus einem eingefügten Text herausschneiden: jeder Code reicht bis zum nächsten "TS32-";
  // Zeilenumbrüche im Code (aus Mails) werden entfernt, folgender Text wird beim Dekodieren abgeschnitten
  const findCodes = text => String(text).split('TS32-').slice(1)
    .map(part => (part.replace(/\s+/g, '').match(/^[A-Za-z0-9+/]+={0,2}/) || [''])[0])
    .filter(c => c.length >= 8);

  // ---------- Diagramme ----------
  const NS = 'http://www.w3.org/2000/svg';
  function niceDomain(values, extra = []) {
    const v = values.concat(extra).filter(x => typeof x === 'number' && isFinite(x));
    if (!v.length) return [70, 100];
    let lo = Math.floor(Math.min(...v) - 1), hi = Math.ceil(Math.max(...v) + 1);
    if (hi - lo < 6) { const c = (hi + lo) / 2; lo = Math.floor(c - 3); hi = Math.ceil(c + 3); }
    return [lo, hi];
  }
  const tickStep = span => (span <= 10 ? 1 : span <= 24 ? 2 : 5);
  const svgOpen = (w, h, label) => `<svg xmlns="${NS}" class="ts32-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">`;
  function thresholdsIn(dom) {
    return [{ v: LOW, cls: 'thr-warn', label: 'unterer Auslösewert 80', anchor: 'end', dx: -8 },
            { v: HIGH, cls: 'thr-crit', label: '85 oberer Auslösewert', anchor: 'start', dx: 8 }]
      .filter(t => t.v >= dom[0] && t.v <= dom[1]);
  }

  // Punktdiagramm: eine Zeile je Gruppe; gefüllter Punkt = L_Aeq bzw. L_EX,8h, offene Kreise = Stichproben,
  // Band = Spannweite zwischen den Gruppen, gestrichelte Linie = energetischer Mittelwert.
  function dotChart({ rows, title, withThresholds = false }) {
    const W = 960, L = 170, R = 110, T = 92, B = 64, RH = 58;
    const n = Math.max(rows.length, 1), H = T + n * RH + B;
    const vals = rows.map(r => r.value).filter(isFinite);
    const samples = rows.flatMap(r => r.samples || []);
    const dom = niceDomain(vals.concat(samples), withThresholds ? [LOW, HIGH] : []);
    const x = v => L + (v - dom[0]) / (dom[1] - dom[0]) * (W - L - R);
    const y = i => T + i * RH + RH / 2;
    const st = stats(vals);
    let s = svgOpen(W, H, title);
    // Raster und Achse
    const step = tickStep(dom[1] - dom[0]);
    for (let t = Math.ceil(dom[0] / step) * step; t <= dom[1]; t += step) {
      s += `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${T - 8}" y2="${H - B + 6}"/>`;
      s += `<text class="tick" x="${x(t)}" y="${H - B + 32}" text-anchor="middle">${t}</text>`;
    }
    s += `<text class="axis" x="${W - R}" y="${H - 8}" text-anchor="end">dB(A)</text>`;
    // Spannweite zwischen den Gruppen
    if (st && st.n > 1) {
      s += `<rect class="band" x="${x(st.mn)}" y="${T - 8}" width="${Math.max(2, x(st.mx) - x(st.mn))}" height="${n * RH + 16}" rx="4"><title>Spannweite ${f1(st.range)} dB</title></rect>`;
    }
    // Grenzwertlinien
    if (withThresholds) for (const t of thresholdsIn(dom)) {
      s += `<line class="${t.cls}" x1="${x(t.v)}" x2="${x(t.v)}" y1="${T - 30}" y2="${H - B + 6}"/>`;
      s += `<text class="thr-label" x="${x(t.v) + t.dx}" y="${T - 34}" text-anchor="${t.anchor}">${t.label}</text>`;
    }
    // Mittelwert
    if (st) {
      s += `<line class="mean" x1="${x(st.mean)}" x2="${x(st.mean)}" y1="${T - 8}" y2="${H - B + 6}"/>`;
      s += `<text class="mean-label" x="${x(st.mean)}" y="${T - (withThresholds ? 62 : 22)}" text-anchor="middle">Ø ${f1(st.mean)}</text>`;
    }
    // Zeilen
    rows.forEach((r, i) => {
      s += `<text class="row-label" x="${L - 16}" y="${y(i) + 7}" text-anchor="end">${esc(r.label)}</text>`;
      s += `<line class="row-line" x1="${L}" x2="${W - R}" y1="${y(i)}" y2="${y(i)}"/>`;
      for (const v of r.samples || []) {
        s += `<circle class="sample" cx="${x(v)}" cy="${y(i)}" r="7"><title>${esc(r.label)}: Stichprobe ${f1(v)} dB(A)</title></circle>`;
      }
      if (isFinite(r.value)) {
        const tip = `${esc(r.label)}: ${f1(r.value)} dB(A)` + ((r.samples || []).length ? ` · Stichproben ${r.samples.map(f1).join(' · ')}` : '');
        s += `<circle class="dot" cx="${x(r.value)}" cy="${y(i)}" r="12"><title>${tip}</title></circle>`;
        s += `<text class="val" x="${W - R + 16}" y="${y(i) + 7}">${f1(r.value)}</text>`;
      } else {
        s += `<text class="val muted" x="${W - R + 16}" y="${y(i) + 7}">–</text>`;
      }
    });
    return s + '</svg>';
  }

  // Zeitverlauf: eine Spalte je Seminar; Punkte = Gruppen, Balken = Spannweite, Querstrich = energetischer Mittelwert
  function seriesChart({ cols, title, withThresholds = false }) {
    const W = 960, L = 84, R = 24, T = 40, B = 92, H = 520;
    const n = Math.max(cols.length, 1);
    const all = cols.flatMap(c => c.values);
    const dom = niceDomain(all, withThresholds ? [LOW, HIGH] : []);
    const cw = (W - L - R) / n;
    const cx = i => L + cw * (i + 0.5);
    const y = v => T + (dom[1] - v) / (dom[1] - dom[0]) * (H - T - B);
    let s = svgOpen(W, H, title);
    const step = tickStep(dom[1] - dom[0]);
    for (let t = Math.ceil(dom[0] / step) * step; t <= dom[1]; t += step) {
      s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`;
      s += `<text class="tick" x="${L - 12}" y="${y(t) + 7}" text-anchor="end">${t}</text>`;
    }
    s += `<text class="axis" x="${L - 12}" y="${T - 14}" text-anchor="end">dB(A)</text>`;
    if (withThresholds) for (const t of thresholdsIn(dom)) {
      s += `<line class="${t.cls}" x1="${L}" x2="${W - R}" y1="${y(t.v)}" y2="${y(t.v)}"/>`;
      s += `<text class="thr-label" x="${W - R - 6}" y="${y(t.v) - 8}" text-anchor="end">${t.label}</text>`;
    }
    const every = Math.ceil(n / 12); // höchstens ca. 12 Datumsbeschriftungen
    cols.forEach((c, i) => {
      const st = stats(c.values);
      if (st && st.n > 1) s += `<rect class="band" x="${cx(i) - Math.min(14, cw * 0.18)}" y="${y(st.mx)}" width="${Math.min(28, cw * 0.36)}" height="${Math.max(2, y(st.mn) - y(st.mx))}" rx="4"><title>${esc(c.label)}: Spannweite ${f1(st.range)} dB</title></rect>`;
      const k = c.values.length;
      c.values.forEach((v, j) => {
        const dx = k > 1 ? (j - (k - 1) / 2) * Math.min(5, cw * 0.3 / k) : 0; // leichte Streuung gegen Überdeckung, innerhalb des Balkens
        s += `<circle class="dot sm" cx="${cx(i) + dx}" cy="${y(v)}" r="7"><title>${esc(c.label)} – ${esc(c.names?.[j] || '')}: ${f1(v)} dB(A)</title></circle>`;
      });
      if (st) s += `<line class="mean-tick" x1="${cx(i) - Math.min(22, cw * 0.32)}" x2="${cx(i) + Math.min(22, cw * 0.32)}" y1="${y(st.mean)}" y2="${y(st.mean)}"><title>${esc(c.label)}: Ø ${f1(st.mean)} dB(A)</title></line>`;
      if (i % every === 0) s += `<text class="tick" x="${cx(i)}" y="${H - B + 34}" text-anchor="middle">${esc(c.label)}</text>`;
    });
    return s + '</svg>';
  }

  // Stilregeln für Diagramme: Rollen statt fester Farben; hell/dunkel; Präsentation immer hell
  const CHART_CSS = `
  .ts32-chart { width:100%; height:auto; display:block; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .viz { --c-series:#2a78d6; --c-band:rgba(42,120,214,.16); --c-surface:#fff; --c-text:#1d2330; --c-muted:#52514e;
         --c-grid:#e4e6eb; --c-warn:#fab219; --c-crit:#d03b3b; }
  @media (prefers-color-scheme: dark) {
    .viz:not(.present) { --c-series:#3987e5; --c-band:rgba(57,135,229,.24); --c-surface:#1e232c; --c-text:#e8ebf0; --c-muted:#c3c2b7; --c-grid:#343b48; }
  }
  .ts32-chart .grid { stroke:var(--c-grid); stroke-width:1; }
  .ts32-chart .row-line { stroke:var(--c-grid); stroke-width:1; stroke-dasharray:2 4; }
  .ts32-chart .tick { fill:var(--c-muted); font-size:18px; }
  .ts32-chart .axis { fill:var(--c-muted); font-size:16px; }
  .ts32-chart .row-label { fill:var(--c-text); font-size:22px; font-weight:600; }
  .ts32-chart .val { fill:var(--c-text); font-size:22px; font-weight:700; font-variant-numeric:tabular-nums; }
  .ts32-chart .val.muted { fill:var(--c-muted); font-weight:400; }
  .ts32-chart .band { fill:var(--c-band); }
  .ts32-chart .dot { fill:var(--c-series); stroke:var(--c-surface); stroke-width:3; }
  .ts32-chart .dot.sm { stroke-width:2; }
  .ts32-chart .sample { fill:var(--c-surface); stroke:var(--c-series); stroke-width:2.5; }
  .ts32-chart .mean { stroke:var(--c-text); stroke-width:2; stroke-dasharray:8 6; }
  .ts32-chart .mean-tick { stroke:var(--c-text); stroke-width:4; stroke-linecap:round; }
  .ts32-chart .mean-label { fill:var(--c-text); font-size:20px; font-weight:700; }
  .ts32-chart .thr-warn { stroke:var(--c-warn); stroke-width:3; }
  .ts32-chart .thr-crit { stroke:var(--c-crit); stroke-width:3; }
  .ts32-chart .thr-label { fill:var(--c-text); font-size:17px; }
  .chart-legend { display:flex; gap:18px; flex-wrap:wrap; font-size:.85rem; color:var(--c-muted); margin:6px 0 0; }
  .chart-legend span { display:inline-flex; align-items:center; gap:6px; }
  .chart-legend .k { display:inline-block; width:16px; height:16px; border-radius:50%; }
  .chart-legend .k-dot { background:var(--c-series); }
  .chart-legend .k-sample { border:2.5px solid var(--c-series); background:var(--c-surface); }
  .chart-legend .k-band { border-radius:3px; background:var(--c-band); width:26px; }
  .chart-legend .k-mean { border-radius:0; height:0; border-top:3px dashed var(--c-text); width:26px; }
  .chart-legend .k-warn { border-radius:0; height:0; border-top:3px solid var(--c-warn); width:26px; }
  .chart-legend .k-crit { border-radius:0; height:0; border-top:3px solid var(--c-crit); width:26px; }
  /* Präsentationsmodus (Beamer): Vollbild, hell, große Schrift */
  .present { position:fixed; inset:0; z-index:1000; background:#fff; color:#1d2330; display:flex; flex-direction:column;
             padding:2.5vh 3vw 1.5vh; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .present h2 { font-size:clamp(28px, 4.2vh, 64px); margin:0; line-height:1.15; }
  .present .p-sub { font-size:clamp(18px, 2.6vh, 38px); color:#52514e; margin:.4vh 0 1vh; }
  .present .p-chart { flex:1; min-height:0; display:flex; align-items:center; justify-content:center; }
  .present .p-chart svg { max-height:100%; width:auto; max-width:100%; height:100%; }
  .present .chart-legend { font-size:clamp(14px, 2vh, 28px); color:#52514e; justify-content:center; }
  .present .p-nav { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:1vh; font-size:clamp(14px, 1.8vh, 24px); color:#52514e; }
  .present .p-nav button { font:inherit; padding:.5em 1em; border-radius:8px; border:1px solid #d9dde5; background:#fff; color:#1d2330; cursor:pointer; }
  `;
  function legendHTML(kind, withThresholds, withSamples = true) {
    const parts = kind === 'series'
      ? ['<span><i class="k k-dot"></i>Gruppe</span>', '<span><i class="k k-band"></i>Spannweite</span>', '<span><i class="k k-mean"></i>Mittelwert (energetisch)</span>']
      : ['<span><i class="k k-dot"></i>Ergebnis der Gruppe</span>', withSamples ? '<span><i class="k k-sample"></i>Stichprobe</span>' : '', '<span><i class="k k-band"></i>Spannweite der Gruppen</span>', '<span><i class="k k-mean"></i>Mittelwert (energetisch)</span>'].filter(Boolean);
    if (withThresholds) parts.push('<span><i class="k k-warn"></i>unterer Auslösewert</span>', '<span><i class="k k-crit"></i>oberer Auslösewert</span>');
    return `<div class="chart-legend">${parts.join('')}</div>`;
  }
  let cssDone = false;
  function injectCSS() { if (cssDone) return; const st = document.createElement('style'); st.textContent = CHART_CSS; document.head.appendChild(st); cssDone = true; }

  // „LEX,8h“ / „LAeq“ mit tiefgestellten Indizes ausgeben (Text wird vorher maskiert)
  const subHTML = t => esc(t).replace('LEX,8h', 'L<sub>EX,8h</sub>').replace('LAeq', 'L<sub>Aeq</sub>');

  // slides: [{ title, sub, svg, legend }]
  function present(slides, start = 0) {
    injectCSS();
    if (!slides.length) return;
    let i = Math.min(start, slides.length - 1);
    const ov = document.createElement('div');
    ov.className = 'present viz';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Präsentation');
    document.body.appendChild(ov);
    const show = () => {
      const sl = slides[i];
      ov.innerHTML = `<h2></h2><div class="p-sub"></div><div class="p-chart">${sl.svg}</div>${sl.legend || ''}
        <div class="p-nav"><button data-a="prev" aria-label="Vorherige Folie">◀ zurück</button><span>${i + 1} / ${slides.length} · Pfeiltasten blättern · Esc beendet</span><button data-a="next" aria-label="Nächste Folie">weiter ▶</button></div>`;
      ov.querySelector('h2').innerHTML = subHTML(sl.title);
      ov.querySelector('.p-sub').textContent = sl.sub || '';
    };
    const go = d => { i = Math.max(0, Math.min(slides.length - 1, i + d)); show(); };
    const close = () => { document.removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', fsc); ov.remove(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
    const key = e => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') { i = 0; show(); } else if (e.key === 'End') { i = slides.length - 1; show(); }
      else if (e.key === 'Escape') close();
    };
    const fsc = () => { if (!document.fullscreenElement) close(); };
    ov.addEventListener('click', e => { const a = e.target.closest('button')?.dataset.a; if (a) go(a === 'next' ? 1 : -1); });
    document.addEventListener('keydown', key);
    show();
    if (ov.requestFullscreen) ov.requestFullscreen().then(() => document.addEventListener('fullscreenchange', fsc)).catch(() => {});
  }

  // CSV mit Anführungszeichen; Texte, die Excel als Formel lesen würde, werden mit ' entschärft
  function downloadCSV(rows, name) {
    const cell = v => {
      let t = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+(,\d+)?$/.test(t)) t = "'" + t;
      return '"' + t.replace(/"/g, '""') + '"';
    };
    downloadText('﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n'), name, 'text/csv;charset=utf-8');
  }
  function downloadText(text, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return { LOW, HIGH, f1, esc, datumDE, leq, sdev, stats, toNum, normalizeGroup, normalizeSeminar, seminarFile,
           decodeCode, findCodes, subHTML, dotChart, seriesChart, legendHTML, injectCSS, present, downloadCSV, downloadText };
})();
