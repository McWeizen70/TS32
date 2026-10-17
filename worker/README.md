# Upload-Worker für die Messübung

Nimmt das Ergebnis aus `messuebung.html` entgegen und legt es als Datei
`eingang/JJJJ-MM-TT/gruppe-N-HHMMSS-<Kennung>.json` (die Uhrzeit sorgt dafür, dass bei mehrfacher Sendung einer Gruppe die letzte gilt) im Repo ab. Das GitHub-Token liegt nur im Worker.

## Einrichtung (einmalig)

1. **GitHub-Token erzeugen:** GitHub → Settings → Developer settings → Personal access tokens →
   *Fine-grained tokens* → *Generate new token*.
   - Repository access: *Only select repositories* → `TS32`
   - Permissions → Repository permissions → **Contents: Read and write** (sonst nichts)
   - Ablaufdatum setzen (z. B. 1 Jahr), Token kopieren.
2. **Worker anlegen:** Cloudflare-Dashboard → *Workers & Pages* → *Create* → *Create Worker*,
   Namen vergeben (z. B. `ts32-upload`), *Deploy*. Dann *Edit code*, den Inhalt von `worker.js`
   einfügen und *Deploy*.
3. **Token hinterlegen:** Worker → *Settings* → *Variables and Secrets* → *Add* → Typ **Secret**,
   Name `GITHUB_TOKEN`, Wert = das Token.
4. **Adresse eintragen:** Die Worker-Adresse (`https://ts32-upload.<subdomain>.workers.dev`) in
   `messuebung.html` bei `WORKER_URL` eintragen. Solange `WORKER_URL` leer ist, bleibt die Messübung
   bei Mail und Datei.
5. **Testen:** Messübung öffnen, Gruppennummer und Werte eingeben, „Ergebnis direkt senden“.
   Danach muss im Repo unter `eingang/` eine neue Datei liegen.

## Optionale Variablen (Worker → Settings → Variables)

| Name | Standard |
|---|---|
| `REPO` | `McWeizen70/TS32` |
| `BRANCH` | `main` |
| `ALLOWED_ORIGIN` | `https://mcweizen70.github.io` |
| `TARGET_DIR` | `eingang` |

## Schutz vor Missbrauch

Der Worker akzeptiert nur das erwartete Format (Gruppennummer 1–99, Zahlenbereiche, höchstens 20 KB)
und übernimmt nur bekannte Felder – Namen o. Ä. gelangen nie ins Repo. Die Herkunftsprüfung
(`Origin`) hält Browser anderer Seiten ab, ein gezieltes Skript kann sie aber fälschen. Eine
Rate-Limit-Regel über die Cloudflare-WAF ist für `workers.dev`-Adressen nicht verfügbar (die WAF-Regeln gelten
für eigene Domains; das Add-on ist kostenpflichtig). Unerwünschte Dateien lassen sich in `eingang/`
einfach löschen; bei Missbrauch das Token auf GitHub widerrufen und ein neues erzeugen.

Das Repo ist öffentlich: Dateien in `eingang/` sind für jeden lesbar (nur Gruppennummer und Messwerte).
