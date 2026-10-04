# TS32
Begleitung des Seminars TS32 "Lärm am Arbeitsplatz"

## Lärmrechner und Messübung

- `messuebung.html` – Messübung für die Gruppen (Stichproben, L<sub>EX,8h</sub>, Ergebnis per Mail oder als Datei)
- `laermrechner.html` – freier Rechner für L<sub>EX,8h</sub> mit Spitzenpegel, Gehörschutz und Messunsicherheit (DIN EN ISO 9612:2025, Gl. C.3)
- `auswertung.html` – Gruppenvergleich für die Seminarleitung
- `index.html` – leitet zur Messübung weiter (Startseite unter GitHub Pages, Ziel des QR-Codes)
- `material/` – QR-Code für https://mcweizen70.github.io/TS32/

### Ablauf Gruppenübung
1. Gruppe öffnet die Messübung über den QR-Code (oder „Messübung herunterladen“ für die Arbeit ohne Netz).
2. Gruppennummer und Namen eintragen, Stichproben je Tätigkeit eingeben (Zeiten sind mit 1 / 2 / 1 / 3 / 1 h vorbelegt).
3. **„Ergebnis per Mail senden“** öffnet eine fertige Mail an m.radtke@bghw.de mit dem Ergebnis-Code – alternativ **„Ergebnis speichern“** (Datei `gruppe-N.json`).
4. Seminarleitung öffnet `auswertung.html` und fügt die Mailtexte ein (Signaturen stören nicht) oder lädt die Dateien. Ergebnis: Min, Max, Spannweite, Mittelwert und s für L<sub>Aeq</sub> je Tätigkeit und für L<sub>EX,8h</sub>.

### Datenschutz
Ergebnisse enthalten die Namen der Teilnehmenden. Das Repo ist öffentlich – Ergebnisdateien mit Namen nicht ins Repo hochladen.
