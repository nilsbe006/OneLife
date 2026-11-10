# ONE LIFE. NO LIMITS. – Technische Architektur

Stand: Phase 1 (Analyse & Architektur)

## 1. Anpassungen gegenüber dem ursprünglichen Prompt

| Ursprünglicher Prompt | Neue Entscheidung | Grund |
|---|---|---|
| Ein gemeinsames Passwort in einer Konfigurationsdatei | **Zwei echte Accounts (Nils & Johannes) mit E-Mail + Passwort** | Passwörter dürfen nicht im Code stehen; jeder braucht eine eigene Identität, damit Bewertungen einer Person zugeordnet werden können |
| LocalStorage als Hauptspeicher | **Supabase (Postgres + Auth) als gemeinsame Datenbank**, LocalStorage nur als Cache / für Quiz-Einstellungen | LocalStorage synchronisiert nicht zwischen Geräten – Nils könnte Johannes' Bewertungen sonst nie sehen |
| JSON-Export als Notlösung zum Teilen | JSON-Export bleibt als **Backup-Funktion** | Teilen passiert jetzt automatisch über die Datenbank |
| Keine Interaktion zwischen den Nutzern | **Vorschläge, Matches, gemeinsamer Kommentar-Thread** | Die App soll ein gemeinsames Planungstool sein, kein Einzel-Bucketlist |

Hosting bleibt **GitHub Pages** (statisch). Supabase ist ein gehosteter Dienst mit kostenlosem Tarif – es entsteht also kein eigenes Backend, das wir betreiben müssen.

## 2. Systemüberblick

```
┌──────────────────────────────┐          HTTPS           ┌────────────────────────────┐
│  GitHub Pages (statisch)     │  ─────────────────────▶  │  Supabase                  │
│  index.html, CSS, Vanilla JS │                          │  • Auth (E-Mail+Passwort)  │
│  activities.js (Katalog)     │  ◀─────────────────────  │  • Postgres + Row Level    │
│  LocalStorage (Cache, Quiz)  │      JSON / Realtime     │    Security                │
└──────────────────────────────┘                          │  • Realtime (optional)     │
                                                          └────────────────────────────┘
```

## 3. Login & Sicherheit

- Login-Bildschirm mit **E-Mail- und Passwortfeld**, Button „Unlock Adventure", Enter bestätigt, Fehlermeldung bei falschen Daten.
- Anmeldung über `supabase.auth.signInWithPassword()`. Passwörter liegen **nur gehasht bei Supabase**, nie im Repository.
- Die beiden Accounts werden **manuell im Supabase-Dashboard** angelegt. Öffentliche Registrierung wird deaktiviert → niemand sonst kann sich einen Account erstellen.
- Session bleibt erhalten (Supabase speichert das Token im Browser), Logout-Button vorhanden.
- In `js/config.js` stehen nur **Supabase-URL und der öffentliche „anon/publishable" Key**. Dieser Key ist von Supabase ausdrücklich für den Browser gedacht; der Schutz der Daten erfolgt über **Row Level Security (RLS)**. Der geheime `service_role`-Key wird **niemals** verwendet oder committet.
- Ehrlicher Hinweis: Die statischen Dateien (Design, Aktivitätenkatalog) sind auf GitHub Pages technisch öffentlich abrufbar. **Geschützt sind die persönlichen Daten** (Bewertungen, Kommentare, Vorschläge) – die liefert die Datenbank nur an eingeloggte Accounts aus.

## 4. Datenmodell

### 4.1 Aktivitätenkatalog – statisch in `js/activities.js`
Der Katalog ist redaktioneller Inhalt (Name, Beschreibung, Kosten, Entfernung, Saison …) und wird versioniert im Code gepflegt. Vorteile: schnell, offline lesbar, per Git nachvollziehbar. Jede Aktivität hat eine stabile `id` (z. B. `"wimsener-hoehle"`), auf die die Datenbank verweist.

Felder pro Aktivität (Auszug):
`id, name, description, why, categories[], image{url, credit}, location{name, lat, lng}, distanceMinFromUlm (geschätzt), costPerPerson{min, max, note}, duration, adrenaline 1–5, difficulty 1–5, setting (outdoor|indoor|both), seasons[], weatherDependent, equipment[], bookingRequired, guideRequired, spontaneity 1–5, minAge, website, tags[], safetyNote, caveType (nur Höhlen: free|ticket|guided|boat|expert-only)`

Persönliche Felder (Favorit, Bewertung, Kommentar, Status) stehen **nicht** im Katalog, sondern in der Datenbank.

### 4.2 Supabase-Tabellen

| Tabelle | Inhalt | Zugriff (RLS) |
|---|---|---|
| `profiles` | `id` (= Auth-User), `display_name`, `avatar` | beide lesen, nur eigenes ändern |
| `user_activity` | `user_id, activity_id, rating (1–5), favorite, note, updated_at` – PK (`user_id`, `activity_id`) | **beide lesen alles**, schreiben nur eigene Zeilen |
| `activity_state` | `activity_id` (PK), `status` (`open`/`planned`/`done`), `planned_date`, `done_date`, `updated_by` | gemeinsamer Status – beide lesen & schreiben |
| `comments` | `id, activity_id, user_id, body, created_at` | beide lesen, nur eigene erstellen/löschen |
| `suggestions` | `id, from_user, to_user, activity_id, message, proposed_date, response (pending/yes/maybe/no), response_note, created_at` | Absender & Empfänger lesen; Absender erstellt, Empfänger antwortet |

**Warum Status gemeinsam, Bewertung pro Person?** Ein Abenteuer wird zusammen erlebt → „Geplant/Erledigt" gilt für beide. Die Meinung dazu ist individuell → jeder hat seine eigenen Sterne und seine eigene Notiz, und beide sehen beide Bewertungen nebeneinander.

## 5. Interaktion zwischen Nils & Johannes

1. **Bewertungen nebeneinander** – Detailansicht zeigt „Nils ★★★★☆ · Johannes ★★★★★" plus Durchschnitt.
2. **Match** – Haben beide dieselbe Aktivität als Favorit markiert, erscheint sie als „It's a Match 🔥" ganz oben.
3. **Vorschlagen** – Button „Johannes vorschlagen" mit optionaler Nachricht und Wunschtermin. Der andere sieht eine Inbox mit Badge und antwortet mit *Bin dabei / Vielleicht / Lieber nicht*. Bei „Bin dabei" wird der Status automatisch auf „Geplant" gesetzt.
4. **Gemeinsamer Kommentar-Thread** pro Aktivität (statt nur ein Freitextfeld).
5. **Aktivitäts-Feed** auf der Startseite: „Johannes hat Canyoning mit 5 Sternen bewertet".
6. Optional (später): Live-Updates per Supabase Realtime.

## 6. Adventure Finder & Filterlogik (`js/quiz.js`, `js/filter.js`)

- 8 Fragen, je eine eigene Ansicht, Fortschrittsbalken, Zurück-Button, Mehrfachauswahl bei Frage 1 (und wo sinnvoll).
- Dynamik: z. B. bei Dauer „Ein paar Stunden" werden Entfernungsoptionen > 60 min ausgegraut; bei „Heute/morgen" werden Spontanitätsoptionen eingeschränkt.
- **Scoring statt hartem Ausschluss**: Jede Aktivität bekommt pro Kriterium *erfüllt / knapp verfehlt / verfehlt*. Harte Kriterien (Budget, Entfernung, Saison bei „heute") schließen aus; weiche Kriterien beeinflussen das Ranking.
- Gibt es keine perfekten Treffer, werden die nächstbesten angezeigt mit Begründung („passt nicht: Budget – ca. 90 € statt < 30 €").
- Saisonprüfung anhand des aktuellen Datums; wetterabhängige Aktivitäten werden markiert.
- Logik als **reine Funktionen** ohne DOM-Zugriff → einfach testbar mit Node (`tests/filter.test.mjs`).

## 7. Dateistruktur

```
/
├── index.html                 Single-Page-App, alle Views als <section>
├── css/
│   └── style.css              Design-Tokens, Komponenten, Responsive
├── js/
│   ├── config.js              Supabase-URL + öffentlicher Key (kein Geheimnis)
│   ├── app.js                 Start, Routing (Hash-Router), View-Wechsel
│   ├── auth.js                Login / Logout / Session
│   ├── activities.js          Aktivitätenkatalog (statisch)
│   ├── quiz.js                Fragen-Definition & Quiz-UI
│   ├── filter.js              Filter- & Scoring-Logik (pure functions)
│   ├── storage.js             Datenzugriff: Supabase + LocalStorage-Cache, Export/Import
│   ├── ui.js                  Karten, Detailansicht, Sterne, Toasts
│   └── trip.js                Blind-Trip-Planer
├── supabase/
│   └── schema.sql             Tabellen + RLS-Policies (einmal im SQL-Editor ausführen)
├── assets/images/             Logo, Favicon, ggf. lokale Fallback-Bilder
├── tests/                     Node-Tests für Filterlogik
├── docs/ARCHITECTURE.md
├── README.md
└── .gitignore
```

JavaScript wird als **native ES-Module** (`<script type="module">`) geladen – kein Build-Schritt. Einzige externe Bibliothek: `@supabase/supabase-js` (gepinnte Version per CDN). Alle Pfade relativ → funktioniert unter `https://<user>.github.io/<repo>/`. Routing per Hash (`#/finder`, `#/activity/wimsener-hoehle`) → kein 404-Problem auf GitHub Pages.

## 8. Design

Dark Mode, Dunkelgrün (`#0f2a1f`/`#1f4d3a`), Schwarz, Anthrazit, Akzent in hellem Moosgrün. Große Display-Typo (z. B. „Bebas Neue" / „Inter" via Google Fonts), Vollbild-Hero mit Naturfoto, abgerundete Karten, dezente Hover- und Übergangsanimationen, `prefers-reduced-motion` wird respektiert. Mobile-first, Bottom-Navigation auf dem Smartphone.

Bilder: Unsplash/Pexels mit Bildnachweis; jedes Bild passt zur tatsächlichen Aktivität (z. B. generisches Höhlenfoto, nicht „angeblich Wimsener Höhle"). Eine Prüf-Skript-Phase testet alle Bild-URLs.

## 9. Phasen & Commits

| Phase | Inhalt | Commit |
|---|---|---|
| 1 | Architektur, Grundgerüst | `chore: initialize adventure planner project` |
| 2 | Design, Login (Supabase Auth), Startseite, Navigation | `feat: implement login with supabase auth`, `feat: create responsive landing page` |
| 3 | Adventure Finder (8 Fragen, Fortschritt, Zurück, Dynamik) | `feat: implement interactive adventure quiz` |
| 4 | Aktivitätendatenbank (33+), Filter- & Scoringlogik + Tests | `feat: add activity database and filtering` |
| 5 | Detailansicht, Favoriten, Bewertungen, Status, Kommentare (gemeinsam) | `feat: create activity detail views`, `feat: add shared ratings, favorites and comments` |
| 6 | Vorschläge, Matches, Feed; Export/Import | `feat: add suggestions and matches`, `feat: add data export and import` |
| 7 | Blind-Trip-Planer, Tests, Mobile-Feinschliff | `feat: add trip planning section`, `style: optimize mobile experience`, `test: validate application functionality` |
| 8 | README, GitHub Pages | `docs: add setup and deployment instructions` |

## 10. Was du (Nils) vor Phase 2 erledigen musst

1. Kostenloses Projekt auf https://supabase.com anlegen (Region: Frankfurt / eu-central-1).
2. *Authentication → Providers → Email*: aktiviert lassen. *Authentication → Sign In / Providers*: **„Allow new users to sign up" ausschalten**.
3. *Authentication → Users → Add user*: Account für dich und für Johannes anlegen (E-Mail + Passwort, „Auto confirm" anhaken).
4. *Project Settings → API*: **Project URL** und **anon / publishable key** an mich geben (diese beiden sind öffentlich und unbedenklich). **Nicht** den `service_role`-/Secret-Key.
5. Das `schema.sql`, das ich in Phase 2 liefere, im SQL-Editor ausführen.
