# Hans & Run

Ein Jump'n'Run mit Hans — Zelt auf, Lächeln an!

Hans ist Camper, und deshalb gilt: Wer rastet, der rostet **nicht** — sondern sammelt
Camping-Bonus. Lauf, spring und stürze dich durch drei Level, stampfe Gegner weg,
sammle Münzen und Power-ups — und wart zwischendurch einfach mal am Lagerfeuer.

## Features

- **3 Level:** Wiese, Nachtlauf, Himmelspfad
- **5 Power-ups:** Schild, Doppelsprung, Turbo und mehr
- **Camping-Bonus:** Still stehen lohnt sich — Hans macht Urlaub am Lagerfeuer (+25 Punkte/Sek.)
- **Combo-System:** Gegner in Serie stampfen bringt Extra-Punkte
- **Touch-Unterstützung:** Auf Handys und Tablets erscheinen Buttons für links, rechts und springen
- **Rekord:** Deine Bestleistung wird lokal gespeichert

## Steuern

| Taste | Wirkung |
|---|---|
| `A`/`D` oder `←`/`→` | Laufen |
| `Leertaste` oder `W` | Springen (länger drücken = höher) |
| `Shift` | Sprint |
| `P` | Pause |
| `M` | Ton an/aus |
| `R` | Level neu aufbauen |

Auf dem Touchscreen: Buttons unten links (laufen) und rechts (springen). Tastatur-Hinweise
werden dort automatisch ausgeblendet.

## Spielen

Einfach `index.html` im Browser öffnen — fertig. Kein Build, keine Abhängigkeiten,
kein Server nötig. Am besten per Doppelklick oder:

```
start index.html
```

## Technik

- Reines HTML/CSS/JavaScript, Canvas 2D — keine Frameworks
- Tile-Kollision, Parallax-Berge, Partikel und WebAudio ( Sounds werden synthetisiert, keine Audiodateien)
- Hans-Sprites: `Hans_walking1.png` / `Hans_walking2.png` (Laufanimation), `Hans_not_walking.png` (Stand), `Hans_mashmellow.png` (Camping)
- Test: `node test-smoke.js` prüft Physik, Gegner, Power-ups und Level-Logik ohne Browser

## Stil

Die UI folgt der **Camper-Hans-Corporate-Identity** (Version 1.2.1): Farben, Fonts und
Komponenten kommen aus `css/camper-hans.css` mit den zugehörigen Tokens in
`tokens/camper-hans.tokens.json`. Mehr dazu im `docs/STYLEGUIDE.md` des CI-Projekts.
