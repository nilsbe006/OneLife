# ONE LIFE. NO LIMITS. – Adventure Planner

*Two friends. One bucketlist. Countless adventures.*

Eine kleine, persönliche Adventure-App für Nils & Johannes: Der **Adventure Finder** fragt in 8 Schritten ab, worauf ihr Lust habt, und schlägt passende Abenteuer rund um Ulm vor. Bewertungen, Favoriten, Kommentare, Status und Vorschläge teilt ihr live miteinander.

**Live:** https://nilsbe006.github.io/OneLife/

## Funktionen

- **Login** mit E-Mail + Passwort (Firebase Authentication), nur für freigeschaltete Accounts
- **Adventure Finder** – 8 Fragen mit Fortschritt, Zurück, Mehrfachauswahl und dynamisch gesperrten Optionen; Antworten jederzeit änderbar
- **Filterlogik** – harte Kriterien (Budget, Dauer, Entfernung ab Ulm, Saison, Vorbereitung) und weiche (Lust, Ort, Adrenalin); nächstbeste Alternativen mit Begründung
- **37 recherchierte Abenteuer** mit Kosten, Fahrzeit, Saison, Buchung/Guide, Ausrüstung, Sicherheitshinweisen; Höhlen nach Zugangsart unterschieden
- **Gemeinsam** – Herz & Sterne (beide Bewertungen nebeneinander), Matches, gemeinsamer Status (geplant/erledigt), Kommentar-Thread, alles live
- **Vorschläge** – „Johannes vorschlagen“ mit Nachricht und Wunschtermin, Inbox mit Glocke, Antworten „Bin dabei / Vielleicht / Lieber nicht“
- **Startseite** mit Statistik und Aktivitäts-Feed
- **Blind-Trip-Planer** – Ziele ab Stuttgart/Friedrichshafen, Links zu Flugsuchen, verdecktes Überraschungsziel (keine erfundenen Preise)
- **Backup** – Export/Import aller Daten als JSON
- Mobile-first, Dark Mode, funktioniert auf iPhone, Android, Tablet und Desktop

## Technik

| Bereich | Lösung |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript (native ES-Module, kein Build-Schritt) |
| Hosting | GitHub Pages (Branch `main`, Ordner `/`) |
| Login | Firebase Authentication (E-Mail/Passwort) |
| Gemeinsame Daten | Cloud Firestore mit Security Rules, Live-Updates per `onSnapshot` |
| Lokal | LocalStorage für Finder-Antworten, Filter und Trip-Planer |
| Tests | `node --test` (Unit) und Playwright (Browser) |

Details zur Architektur: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Bildnachweise: [docs/CREDITS.md](docs/CREDITS.md)

## Projektstruktur

```
index.html              Single-Page-App (Login, Topbar, Navigation)
css/style.css           Design-System, alle Komponenten, Responsive
js/
  config.js             Firebase-Web-Konfiguration (öffentlich, kein Geheimnis)
  firebase.js           Initialisierung (SDK 10.12.2, gepinnt)
  auth.js               Login, Logout, Allowlist-Prüfung, Passwort-Reset
  app.js                Start, Hash-Router, Live-Refresh der Ansichten
  views.js              Startseite + Routen-Tabelle
  quiz.js / finder.js   Fragen & Regeln / Finder-Oberfläche
  activities.js         Aktivitätenkatalog (hier neue Abenteuer eintragen)
  images.js             Bilder mit Urheber & Lizenz
  filter.js             Filter- und Scoring-Logik
  cards.js / catalog.js Karten, „Alle Abenteuer“, Detailansicht
  store.js              Firestore-Daten (Bewertungen, Status, Kommentare, Vorschläge)
  social.js             Herz, Sterne, Status, Kommentare
  lists.js              Favoriten & Erledigt
  inbox.js / feed.js    Vorschläge & Aktivitäts-Feed
  settings.js           Konto, JSON-Export/-Import
  trip.js / trip-view.js Blind-Trip-Planer
  storage.js            LocalStorage-Helfer
firebase/firestore.rules Zugriffsregeln (in der Firebase-Konsole einfügen)
tests/                  Unit-Tests (*.test.mjs) und Browser-Tests (e2e/)
docs/                   Architektur & Bildnachweise
```

## Einrichtung (einmalig)

### 1. Firebase-Projekt

1. In der [Firebase-Konsole](https://console.firebase.google.com) ein Projekt anlegen (oder ein leeres bestehendes nutzen).
   ⚠️ Die Firestore-Regeln gelten für die **ganze** Datenbank des Projekts – kein Projekt verwenden, in dem eine andere App Daten hat.
2. **Authentication → Sign-in method:** „E-Mail/Passwort“ aktivieren.
3. **Authentication → Settings → User actions:** „Enable create (sign-up)“ **ausschalten** – niemand kann sich selbst registrieren.
4. **Authentication → Settings → Authorized domains:** `nilsbe006.github.io` hinzufügen (`localhost` ist schon drin).
5. **Authentication → Users → Add user:** je einen Account für Nils und Johannes anlegen. Die **User UID** beider notieren.
6. **Firestore Database:** Datenbank `(default)` im Produktionsmodus erstellen (Standort z. B. `eur3`).
7. **Firestore → Daten:** Collection `members` anlegen, darin pro Person ein Dokument:
   - Dokument-ID = **exakt die User UID** (nicht „Automatische ID“!)
   - Feld `displayName` (string) = `Nils` bzw. `Johannes`
8. **Firestore → Regeln:** Inhalt von [`firebase/firestore.rules`](firebase/firestore.rules) einfügen und **Veröffentlichen**.
9. **Projekteinstellungen → Allgemein → Meine Apps:** Web-App registrieren und das `firebaseConfig`-Objekt in [`js/config.js`](js/config.js) eintragen.

> Die Werte in `config.js` (inkl. `apiKey`) sind laut Firebase **öffentlich** und für den Browser gedacht. Geschützt werden die Daten durch die Security Rules. Einen **Service-Account-Schlüssel** (JSON) niemals ins Repository legen.

### 2. Lokal starten

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Ein lokaler Server ist nötig, weil ES-Module nicht über `file://` laden.

### 3. Veröffentlichen mit GitHub Pages

1. Änderungen auf `main` pushen.
2. Im Repository **Settings → Pages → Build and deployment:** Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
3. Nach ca. 1 Minute ist die Seite unter `https://nilsbe006.github.io/OneLife/` erreichbar. Spätere Pushes werden automatisch veröffentlicht.

Alle Pfade sind relativ und die App nutzt Hash-Routing (`#/finder`, `#/activity/…`) – sie funktioniert deshalb im Unterordner `/OneLife/` ohne weitere Konfiguration. Die Datei `.nojekyll` sorgt dafür, dass GitHub Pages die Dateien unverändert ausliefert.

**Nach einem Update** zeigt das Handy manchmal noch die alte Version (Browser-Cache): Seite neu laden bzw. Tab schließen und neu öffnen.

## Fehlerbehebung beim Login

| Meldung | Ursache / Lösung |
|---|---|
| „E-Mail oder Passwort stimmt nicht.“ | Account existiert nicht in *diesem* Firebase-Projekt oder Passwort falsch → in der Konsole Passwort zurücksetzen |
| „… nicht freigeschaltet. Deine UID: …“ | Kein Dokument mit genau dieser UID in `members` |
| „Zugriff von der Datenbank verweigert …“ | Firestore-Regeln nicht (aktuell) veröffentlicht |
| „Anmeldung fehlgeschlagen (auth/…)“ | Fehlercode in der Firebase-Doku nachschlagen |

## Abenteuer hinzufügen oder ändern

Neue Abenteuer kommen in [`js/activities.js`](js/activities.js) (Kommentare am Dateianfang erklären alle Felder). Bilder in [`js/images.js`](js/images.js) eintragen – bei Fotos konkreter Orte nur Bilder mit passender Lizenz (z. B. Wikimedia Commons) und mit Urheberangabe. Danach:

```bash
npm test   # prüft u. a. Pflichtfelder, eindeutige IDs, "spontan"/"kostenlos"-Konsistenz
```

Die IDs (`id`) bestehender Abenteuer nicht ändern – Bewertungen, Kommentare und Status hängen daran.

## Daten, Datenschutz & Sicherheit

- **Geschützt (Firestore):** Bewertungen, Favoriten, Status, Kommentare, Vorschläge – lesbar nur für Accounts in `members`; jeder kann nur eigene Bewertungen/Kommentare schreiben und Vorschläge nur beantworten, wenn sie an ihn gehen.
- **Öffentlich (GitHub Pages):** Design, Code und Aktivitätenkatalog. Hier stehen keine Passwörter oder persönlichen Daten.
- **Lokal im Browser:** Finder-Antworten, Filter, Trip-Planer.
- **Backup:** Einstellungen (Tipp auf den Avatar) → „JSON exportieren“. Der Import stellt nur fehlende eigene Daten wieder her und überschreibt nichts.
- Preise, Öffnungszeiten und Saisons sind Recherche-Stand November 2026 bzw. Schätzwerte – vor dem Losfahren auf der verlinkten offiziellen Seite prüfen.

## Tests

```bash
# Unit-Tests (Filterlogik, Datenqualität, Quiz, Trip-Planer) – nur Node nötig
npm test

# Browser-Tests (Playwright) auf iPhone-, Android-, Tablet- und Desktop-Größe
npm install
npx playwright install chromium
npm run test:e2e                                   # gegen lokale Kopie (startet eigenen Server)
BASE=https://nilsbe006.github.io/OneLife/ npm run test:e2e   # gegen die Live-Seite
npm run test:e2e -- trip                           # nur eine Datei
```

Die Browser-Tests ersetzen Firebase durch eine Attrappe (`tests/e2e/mock-firebase.mjs`), die dieselben Besitzregeln wie `firebase/firestore.rules` prüft. Zwei Tabs teilen sich deren „Datenbank“ – so werden Live-Updates zwischen Nils und Johannes getestet. Echte Firebase-Daten werden dabei nicht verändert.

## Ideen für später

- Push-Benachrichtigung bei neuen Vorschlägen (Firebase Cloud Messaging)
- Eigene Abenteuer direkt in der App anlegen (Firestore statt `activities.js`)
- Wetter-API für „Heute/morgen“-Vorschläge
- Fotos zu erledigten Abenteuern (Firebase Storage)
