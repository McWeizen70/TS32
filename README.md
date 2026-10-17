# TS32
Begleitung des Seminars TS32 "Lärm am Arbeitsplatz"

## Lärmrechner und Messübung

- `messuebung.html` – Messübung für die Gruppen (Stichproben, L<sub>EX,8h</sub>, Ergebnis per Mail oder als Datei). Keine Eingabe von Namen oder anderen personenbezogenen Daten.
- `laermrechner.html` – freier Rechner für L<sub>EX,8h</sub> mit Spitzenpegel, Gehörschutz und Messunsicherheit (DIN EN ISO 9612:2025, Gl. C.3)
- `auswertung.html` – Gruppenvergleich eines Seminars mit Tabellen, Grafiken und Präsentationsmodus für den Beamer; erzeugt die Archivdatei für die Langzeitauswertung. Einzeldatei – funktioniert auch heruntergeladen ohne Internet.
- `langzeit.html` – Langzeitauswertung über alle archivierten Seminare (lädt die Dateien aus `ergebnisse/`)
- `eingang/` – direkt gesendete Gruppenergebnisse, je Seminartag ein Ordner `JJJJ-MM-TT/` (legt der Upload-Worker an)
- `worker/` – Cloudflare Worker für „Ergebnis direkt senden“ (Einrichtung: `worker/README.md`)
- `ergebnisse/` – Archivdateien `seminar-JJJJ-MM-TT.json`
- `index.html` – leitet zur Messübung weiter (Startseite unter GitHub Pages, Ziel des QR-Codes)
- `material/` – QR-Code für https://mcweizen70.github.io/TS32/

### Ablauf Gruppenübung
1. Gruppe öffnet die Messübung über den QR-Code (oder „Messübung herunterladen“ für die Arbeit ohne Netz).
2. Gruppennummer eintragen, Stichproben je Tätigkeit eingeben (Zeiten sind mit 1 / 2 / 1 / 3 / 1 h vorbelegt).
3. **„Ergebnis direkt senden“** übermittelt das Ergebnis über den Upload-Worker ins Repo (Ordner `eingang/`). Nur auf der Webseite, nicht in der heruntergeladenen Datei. Ausweichwege: **„Ergebnis per Mail senden“** (fertige Mail an m.radtke@bghw.de mit dem Ergebnis-Code) oder **„Ergebnis speichern“** (Datei `gruppe-N.json`).
4. Seminarleitung öffnet `auswertung.html`, wählt das Seminardatum und klickt **„Eingegangene Ergebnisse laden“**. Alternativ Mailtexte einfügen (Signaturen stören nicht) oder Dateien laden. Ergebnis: Tabellen, Grafiken und der Präsentationsmodus für den Beamer (Pfeiltasten, Esc).
5. Für die Langzeitauswertung in der Auswertung „Archivdatei erstellen“ und die Datei im Ordner `ergebnisse/` hochladen.

### Datenschutz
Die Messübung fragt keine personenbezogenen Daten ab. Direkt gesendete Ergebnisse liegen im öffentlichen Repo (Ordner `eingang/`) – nur Gruppennummer und Messwerte. Mails zeigen der Seminarleitung die Absenderadresse; in die Auswertung und die Archivdateien gelangen nur Gruppennummer und Messwerte. Ältere Codes, die noch Namen enthalten, werden beim Einlesen ohne Namen übernommen.

### Hinweis für Änderungen
`auswertung.html` und `langzeit.html` enthalten denselben gemeinsamen Programmteil (zwischen „Gemeinsamer Teil“ und „Ende gemeinsamer Teil“), damit jede Seite einzeln heruntergeladen werden kann. Änderungen daran in beiden Dateien vornehmen.
