# AGENTS.md – Camper Hans CI Repo

Dieses Repository enthält die **Corporate Identity (CI) von Camper Hans**. Sie wird von KI-Agents genutzt, um Websites, Browsergames und andere Projekte im einheitlichen Hans-Stil umzusetzen.

## Verbindliche Regeln für jeden Agent, der hier arbeitet oder die CI in ein Projekt überträgt

1. **Lies zuerst** `docs/STYLEGUIDE.md` komplett — dort stehen alle Regeln, Farben, Fonts, Snippets und Do's & Don'ts.
2. **Source of Truth** für Werte ist `tokens/camper-hans.tokens.json`; umgesetzt als CSS-Variablen in `css/camper-hans.css`. Beide Dateien gehören zusammen — Änderungen immer in beiden vornehmen und `version` im `$meta`-Block hochzählen.
3. **Keine neuen Farben, Fonts oder Stile erfinden.** Wenn ein Projekt etwas braucht, das die CI nicht hergibt: Nutzer fragen.
4. Projekte, die im Hans-Stil gebaut werden, binden `css/camper-hans.css` ein und verwenden ausschließlich die `ch-`-Klassen und `--ch-*`-Variablen. Startpunkt: `templates/starter/`.
5. **Referenzseiten:** `styleguide/index.html` zeigt alle Komponenten live. Neu gebaute Projekte sollten dort optisch „dazupassen“.
6. **Sprache:** Deutsch, Du-Form, verspielt und mutmachend (Tonalität in `docs/STYLEGUIDE.md` Abschnitt 1).
7. **Assets** in `images/` (Hintergründe, Buchcover) nicht verändern, nicht umfärben. Hero-Hintergrund: `background-cover-mit-Hans2.png`.
8. Nach Änderungen an Tokens oder CSS: `styleguide/index.html` im Browser prüfen (nichts darf kaputtgehen) und die Demo-Seite bei Bedarf erweitern.
