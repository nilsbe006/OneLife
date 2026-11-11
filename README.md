# ONE LIFE. NO LIMITS. – Adventure Planner

*Two friends. One bucketlist. Countless adventures.*

Interaktiver Adventure-Planer für Nils & Johannes: Adventure Finder, gemeinsame Bewertungen, Vorschläge und Matches.

- Frontend: HTML, CSS, Vanilla JS (ES-Module), gehostet auf GitHub Pages
- Daten & Login: Firebase (Authentication + Cloud Firestore mit Security Rules)

Architektur: siehe [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Setup- und Deployment-Anleitung folgt in Phase 8.

## Lokal starten

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Tests

```bash
# Unit-Tests (Filterlogik, Datenqualität, Quiz, Trip-Planer) – nur Node nötig
npm test

# Browser-Tests (Playwright) auf iPhone-, Android-, Tablet- und Desktop-Größe
npm install
npx playwright install chromium
npm run test:e2e            # alle
npm run test:e2e -- trip    # nur eine Datei
```

Die Browser-Tests ersetzen Firebase durch eine Attrappe (`tests/e2e/mock-firebase.mjs`),
die dieselben Besitzregeln wie `firebase/firestore.rules` prüft. Zwei Tabs teilen sich
deren „Datenbank“, so werden Live-Updates zwischen Nils und Johannes getestet.
