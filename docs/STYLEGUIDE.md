# Camper Hans – KI-Styleguide

**Version 1.0.0** · Source of Truth: `tokens/camper-hans.tokens.json`

Dieser Styleguide ist für KI-Agents geschrieben. Wenn du ein Projekt im Camper-Hans-Stil umsetzt (Website, Browsergame, Landingpage, Newsletter …), folge diesen Regeln. Der Stil ist **verspielt, lustig, naturverbunden und kindlich-bunt** — wie ein Cartoon-Campingurlaub.

---

## 1. Marke & Tonalität

- **Camper Hans** ist die Marke. Hans ist der verschrobene, herzensgute Camper — das Maskottchen.
- **Sprache:** Deutsch, Du-Form, freundlich, mutmachend, gern mit Wortspielen rund um Camping, Lagerfeuer, Wald, Zelte, Marshmallows.
- **Beispiel-Sprüche:**
  - „Zelt auf, Lächeln an!“
  - „Hans sagt: Draußen ist der beste Ort.“
  - „Kaffee ans Lagerfeuer, wir starten!“
- UI-Texte duzen die Nutzer. Fehlermeldungen bleiben freundlich und leicht: „Ups, da ist ein Ast im Weg — versuch es nochmal!“ statt „Ungültige Eingabe“.
- Überschriften dürfen einen hervorgehobenen farbigen Begriff mit `<em>` enthalten.

## 2. Grundprinzipien des Designs

1. **Sticker-Look:** Karten, Buttons und Badges haben einen dicken, dunklen Rand (`2–3px #22333B`) und einen versetzten „Pop“-Schatten — wie Aufkleber im Heft.
2. **Vieles ist ein bisschen schief:** Badges/Sticker rotieren leicht (`-2°` bis `+2°`). Wirkt handgemacht, nicht nachlässig.
3. **Runde Ecken überall:** Radius 8–28px, Buttons/Karten nie eckig.
4. **Bunte Vielfalt, seriell eingesetzt:** Eine Grundfarbe pro Fläche (z. B. Card `ch-card-sun`), nicht wild gemischt.
5. **Hintergrund:** Creme (`--ch-cream`) statt purem Weiß. Das ist der „Papier“-Look.
6. **Lustig, aber lesbar:** Der Witz kommt aus Farben, Formen und Sprüchen — nie auf Kosten der Lesbarkeit und Kontraste.

## 3. Farben

| Token | Hex | Einsatz |
|---|---|---|
| `--ch-cream` | `#FFF6E3` | Seitenhintergrund |
| `--ch-paper` | `#FFFDF5` | Karten, Panels |
| `--ch-night` | `#22333B` | Text, Outlines Ränder |
| `--ch-night-soft` | `#4E5D66` | Sekundärtext |
| `--ch-forest` / `-dark` / `-soft` | `#4E9F3D` / `#37762B` / `#E4F2DC` | Primärfarbe: Haupt-CTAs, Erfolg |
| `--ch-sky` / `--ch-lake` / `-soft` | `#6FC3E8` / `#2F7FA6` / `#E1F3FB` | Sekundär, Wasser, Info |
| `--ch-sun` / `-dark` / `-soft` | `#FFCB3C` / `#F0AE1F` / `#FFF3CE` | Highlights, Fokus, Warnung |
| `--ch-campfire` / `-dark` / `--ch-fire-soft` | `#E8623C` / `#C6451F` / `#FCE3D9` | Feuer, Fehler, warme Aktion |
| `--ch-wood` / `-dark` / `-soft` | `#8B5A2B` / `#6E431F` / `#F3E6D7` | Holz, Erde, Footer |
| `--ch-berry` / `-soft` | `#B14E8D` / `#F9E1F1` | Bonusfarbe, Spiel-Items |

**Regeln:**
- Pro Ansicht maximal **eine dominante Akzentfarbe** + Forest als Primär.
- Text auf farbigen Flächen: Weiß auf `forest/campfire/berry/lake`, Night auf `sun/sky/alle Soft-Töne`.
- Fehler = Campfire, Erfolg = Forest, Info = Sky, Warnung = Sun. Immer.

## 4. Schriften

| Font | Gewichte | Einsatz |
|---|---|---|
| **Lora** (Display) | 500/600/700 | Überschriften, Buttons, Badges, Logo, Spiel-Titel |
| **Nunito** (Body) | 400/600/700 | Fließtext, Formulare, UI |
| **Caveat** (Hand) | 500–700 | Hans' handgeschriebene Notizen, Sprüche, Tooltips, Footer-Verabschiedung |

Einbindung (bereits in `camper-hans.css` enthalten):
```html
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Nunito:wght@400;600;700&family=Caveat:wght@500;600;700&display=swap" rel="stylesheet">
```
Hinweis zu Lora: maximales Gewicht 700 — nie `font-weight: 800` für Display-Elemente verwenden. Keine anderen Schriften ohne Rückfrage beim Nutzer.

## 5. Assets (Bildwelt)

| Datei | Einsatz |
|---|---|
| `images/logos/logo-hans-emblem.png` | **Hauptlogo (rund):** Header, Favicon, Lade-Screens, Sticker. Hans mit Bommelmütze vor grünen Bäumen, Zelt unten rechts. |
| `images/logos/logo-hans-portrait.png` | **Porträt (Hans ohne Hintergrund):** Steckbrief, „Über“-Seiten, Credits, Game-Over/Feedback-Boxen, Avatar. |
| `images/background-cover-mit-Hans2.png` | Hero-Hintergrund mit Hans (5413×3000). Klasse `ch-hero` nutzt ihn automatisch. |
| `images/background.png` | Alternativer Vollflächen-Hintergrund ohne Hans. |
| `images/Buchcover.jpg` | Referenz/Produktbild, nicht als Textur nutzen. |

**Regeln:**
- Hans nicht verzerren, nicht umfärben, nicht beschneiden. Logo nicht spiegeln/negativ darstellen.
- Freiraum: rund um ein Logo mindestens 25 % der Logo-Höhe frei lassen.
- Logo-Farben sind die CI-Farben (Waldgrün, Campfire-Orange, Nacht-Outlines) — Logos sitzen deshalb gut auf Creme, Papier und allen Soft-Tönen. Auf Forest/Wood-Flächen nur in Weiß-Kopie bzw. mit hellem Hintergrund-Pad.

**Header mit Logo (Standard):**
```html
<a class="ch-logo" href="#">
  <img src="images/logos/logo-hans-emblem.png" alt="Camper Hans Logo">
  <b>Camper</b> Hans
</a>
```
Größen: `.ch-logo-sm` (28px) / Standard (36px) / `.ch-logo-lg` (56px).

**Porträt-Verwendung:**
```html
<img class="ch-portrait" src="images/logos/logo-hans-portrait.png" alt="Camper Hans">
<img class="ch-portrait ch-portrait-lg" src="images/logos/logo-hans-portrait.png" alt="Camper Hans">
```
(zirkulärer Sticker-Rand; `.ch-portrait-sm` für Avatare z. B. in Kommentaren)

- Bilder in Sticker-Rahmen: Klasse `ch-sticker` nutzen.
- Eigenes/Illustrationen im selben Cartoon-Stil: kräftige Farbflächen, dicke Outlines, keine Photorealismus-Mischung.

## 6. Komponenten (fertige HTML-Snippets)

Voraussetzung: `css/camper-hans.css` einbinden, Body bekommt `class="ch-body"` (oder du übernimmst die Basisstile selbst).

### Button
```html
<button class="ch-btn ch-btn-primary">Los geht's!</button>
<button class="ch-btn ch-btn-sun">Spenden</button>
<button class="ch-btn ch-btn-ghost ch-btn-sm">Abbrechen</button>
```
Varianten: `-primary -sun -sky -fire -berry -ghost`, Größen `-sm -lg`. EIN Haupt-CTA pro Ansicht bekommt `ch-btn-primary`.

### Card
```html
<div class="ch-card">
  <span class="ch-badge">Neu</span>
  <h3 class="ch-h3">Zeltplatz-Typ</h3>
  <p class="ch-lead">Kurzer, freundlicher Text.</p>
</div>
```
Tönungen: `ch-card-sun/-sky/-forest/-fire/-wood/-berry`. Grid: `ch-grid ch-grid-2` bzw. `-3`, `-4`.

### Badge / Tag / Sticker
```html
<span class="ch-badge ch-badge-forest">Level 3</span>
<span class="ch-tag">Zelt</span>
<span class="ch-sticker"><img src="..." alt="Hans am Lagerfeuer"></span>
```

### Alert
```html
<div class="ch-alert ch-alert-success">
  <p class="ch-alert-title">Geschafft!</p>
  Das Zelt steht. Zeit für ein Stockbrot.
</div>
```

### Formular
```html
<label class="ch-label" for="name">Dein Name</label>
<input class="ch-input" id="name" placeholder="Hans">
<p class="ch-help">Hans tippt hier gern mit.</p>
```

### Header / Footer / Hero
```html
<header class="ch-header">
  <div class="ch-header-inner">
    <a class="ch-logo" href="#">
      <img src="images/logos/logo-hans-emblem.png" alt="Camper Hans Logo">
      <b>Camper</b> Hans
    </a>
    <nav class="ch-nav">
      <a href="#" class="ch-active">Zuhause</a>
      <a href="#">Spiele</a>
    </nav>
  </div>
</header>

<section class="ch-hero">
  <div class="ch-hero-inner">
    <h1>Zelt auf, <em>Lächeln</em> an!</h1>
    <p class="ch-lead">...</p>
    <button class="ch-btn ch-btn-primary ch-btn-lg">Mit Hans losziehen</button>
  </div>
</section>

<footer class="ch-footer">
  <div class="ch-footer-cols">...</div>
  <p class="ch-footer-copy">Bis bald am Lagerfeuer! — Hans</p>
</footer>
```

### Spiel-Elemente (Browsergames)
```html
<!-- HUD -->
<div class="ch-hud">
  <span class="ch-stat">42<small>Marshmallows</small></span>
  <span class="ch-badge ch-badge-fire">3 Leben</span>
</div>

<!-- Fortschrittsbalken -->
<div class="ch-progress" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100">
  <span class="ch-progress-bar" style="width:60%"></span>
</div>

<!-- Tooltip -->
<span class="ch-tooltip-wrap">❓<span class="ch-tooltip">Hans erklärt's dir!</span></span>
```
Feedback-Animationen: `ch-bounce` (Erfolg), `ch-shake` (Fehler), `ch-float` (schwebende Sticker).

## 7. Spielregeln für Browsergames

- UI/Buttons immer `ch-btn`-Sticker-Stil — sieht nach „spielbar“ aus.
- HUD oben: `ch-hud` mit `ch-stat` für Score/Leben.
- Erfolge = Sun-Glanz + `ch-bounce`; Fehler = `ch-shake` + Campfire-Alert. Nie hartes Rot-Pulsieren.
- Berry für Power-ups/Items reservieren.
- Canvas-Element (Spielfläche) bekommt selbst auch `border: 3px solid var(--ch-night); border-radius: 20px; box-shadow: var(--ch-shadow-soft);`.
- `prefers-reduced-motion` respektieren — die CSS-Animationen machen das bereits.

## 8. Do's & Don'ts

**Do**
- Creme-Hintergrund, Sticker-Ränder, schräge Badges, Display-Font für alles Titelige.
- Emojis illustrativ in Texten nutzen (Zelt ⛺, Lagerfeuer …) — aber sparsam, max. 1–2 pro Absatz.
- Hand-Font (`.ch-hand`) für Persönliches: Grüße, Tipps, Tooltips.

**Don't**
- Keine Gradients auf Flächen (Ausnahme: Streifen-Muster im `ch-progress-bar`).
- Kein reines Schwarz/Weiß, keine Grautöne als Flächenfarbe.
- Keine eckigen, schattenlosen Elemente — alles bekommt Rand und Schatten auf dem Creme-Grund.
- Keine neuen Farben erfinden: nur die Tokens. Fehlt etwas → beim Nutzer nachfragen.

## 9. So bindest du die CI in ein Projekt ein

1. `css/camper-hans.css` ins Projekt kopieren (oder aus diesem Repo verlinken: `camper-hans-ci/css/camper-hans.css`). Wichtig: Der relative Pfad `../images/...` im Hero funktioniert nur, wenn auch `images/` mitkopiert wird — sonst Hero-Bild manuell referenzieren.
2. `<link rel="stylesheet" href="css/camper-hans.css">` im `<head>`.
3. `<body class="ch-body">`.
4. Komponenten mit den `ch-`-Klassen bauen (Snippets: Abschnitt 6).
5. Bei Änderungswünschen an Farben/Werten: `tokens/camper-hans.tokens.json` UND `css/camper-hans.css` gemeinsam aktualisieren und Version im `$meta`-Block hochzählen.
