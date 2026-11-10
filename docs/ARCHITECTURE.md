# ONE LIFE. NO LIMITS. – Technische Architektur

Stand: Phase 1 (Analyse & Architektur) – Backend: **Firebase**

## 1. Anpassungen gegenüber dem ursprünglichen Prompt

| Ursprünglicher Prompt | Neue Entscheidung | Grund |
|---|---|---|
| Ein gemeinsames Passwort in einer Konfigurationsdatei | **Zwei echte Accounts (Nils & Johannes) mit E-Mail + Passwort** über Firebase Authentication | Passwörter dürfen nicht im Code stehen; jeder braucht eine eigene Identität, damit Bewertungen einer Person zugeordnet werden können |
| LocalStorage als Hauptspeicher | **Cloud Firestore als gemeinsame Datenbank**, LocalStorage nur für Quiz-Einstellungen / Cache | LocalStorage synchronisiert nicht zwischen Geräten – Nils könnte Johannes' Bewertungen sonst nie sehen |
| JSON-Export als Notlösung zum Teilen | JSON-Export bleibt als **Backup-Funktion** | Teilen passiert jetzt automatisch über die Datenbank |
| Keine Interaktion zwischen den Nutzern | **Vorschläge, Matches, gemeinsamer Kommentar-Thread, Feed** | Die App soll ein gemeinsames Planungstool sein |

Hosting bleibt **GitHub Pages** (statisch). Firebase (Spark-Tarif, kostenlos) liefert Login und Datenbank – kein eigener Server.

## 2. Systemüberblick

```
┌──────────────────────────────┐          HTTPS           ┌────────────────────────────┐
│  GitHub Pages (statisch)     │  ─────────────────────▶  │  Firebase                  │
│  index.html, CSS, Vanilla JS │                          │  • Authentication          │
│  activities.js (Katalog)     │  ◀─────────────────────  │    (E-Mail + Passwort)     │
│  LocalStorage (Quiz, Cache)  │   Echtzeit-Listener      │  • Cloud Firestore         │
└──────────────────────────────┘                          │  • Security Rules          │
                                                          └────────────────────────────┘
```

## 3. Login & Sicherheit

- Login-Bildschirm mit **E-Mail- und Passwortfeld**, Button „Unlock Adventure", Enter bestätigt, verständliche Fehlermeldung.
- Anmeldung über `signInWithEmailAndPassword()`. Passwörter liegen **nur bei Firebase**, nie im Repository. „Passwort vergessen" über `sendPasswordResetEmail()`.
- Die beiden Accounts werden **manuell in der Firebase-Konsole** angelegt; Selbstregistrierung wird deaktiviert.
- **Doppelte Absicherung über Security Rules:** Zugriff nur, wenn ein Dokument `members/{uid}` existiert. Selbst wenn jemand einen Account erstellen könnte, sieht er keine Daten.
- In `js/config.js` steht nur die **Firebase-Web-Konfiguration** (`apiKey`, `projectId` …). Diese Werte sind laut Firebase öffentlich und für den Browser gedacht; geschützt wird über die Security Rules. Service-Account-Keys (JSON) werden **niemals** verwendet oder committet.
- Ehrlicher Hinweis: Die statischen Dateien (Design, Aktivitätenkatalog) sind auf GitHub Pages öffentlich abrufbar. **Geschützt sind die persönlichen Daten** (Bewertungen, Kommentare, Vorschläge).

## 4. Datenmodell

### 4.1 Aktivitätenkatalog – statisch in `js/activities.js`
Redaktioneller Inhalt, versioniert im Code. Jede Aktivität hat eine stabile `id` (z. B. `"wimsener-hoehle"`), auf die Firestore verweist.

Felder (Auszug):
`id, name, description, why, categories[], image{url, credit}, location{name, lat, lng}, distanceMinFromUlm (geschätzt), costPerPerson{min, max, note}, duration, adrenaline 1–5, difficulty 1–5, setting (outdoor|indoor|both), seasons[], weatherDependent, equipment[], bookingRequired, guideRequired, spontaneity 1–5, minAge, website, tags[], safetyNote, caveType (nur Höhlen: free|ticket|guided|boat|expert-only)`

### 4.2 Firestore-Collections

| Collection / Dokument | Inhalt | Zugriff (Security Rules) |
|---|---|---|
| `members/{uid}` | `displayName`, `avatar` – wird manuell angelegt, dient als Allowlist | Mitglieder lesen; ändern nur eigenes Profil |
| `ratings/{uid}_{activityId}` | `uid, activityId, rating 1–5, favorite, note, updatedAt` | Mitglieder lesen alles; schreiben nur, wenn `uid == request.auth.uid` |
| `activityState/{activityId}` | `status (open/planned/done), plannedDate, doneDate, updatedBy` | gemeinsamer Status – Mitglieder lesen & schreiben |
| `comments/{autoId}` | `activityId, uid, body, createdAt` | Mitglieder lesen; erstellen/löschen nur eigene |
| `suggestions/{autoId}` | `fromUid, toUid, activityId, message, proposedDate, response (pending/yes/maybe/no), responseNote, createdAt` | Absender & Empfänger lesen; Absender erstellt; Empfänger setzt nur `response`/`responseNote` |

Die Regeln liegen versioniert in `firebase/firestore.rules` und werden in der Konsole eingefügt (oder per `firebase deploy --only firestore:rules`).

**Status gemeinsam, Bewertung pro Person:** Ein Abenteuer wird zusammen erlebt → „Geplant/Erledigt" gilt für beide. Die Meinung ist individuell → jeder hat eigene Sterne und Notizen, beide sehen beide Bewertungen.

## 5. Interaktion zwischen Nils & Johannes

1. **Bewertungen nebeneinander** – „Nils ★★★★☆ · Johannes ★★★★★" plus Durchschnitt.
2. **Match** – beide haben dieselbe Aktivität favorisiert → „It's a Match 🔥" ganz oben.
3. **Vorschlagen** – Nachricht + Wunschtermin an den anderen; Inbox mit Badge; Antwort *Bin dabei / Vielleicht / Lieber nicht*. „Bin dabei" setzt den Status auf „Geplant".
4. **Gemeinsamer Kommentar-Thread** pro Aktivität.
5. **Feed** auf der Startseite: „Johannes hat Canyoning mit 5 Sternen bewertet".
6. **Live-Updates** per Firestore `onSnapshot` – Änderungen des anderen erscheinen ohne Neuladen.

## 6. Adventure Finder & Filterlogik (`js/quiz.js`, `js/filter.js`)

- 8 Fragen, je eine eigene Ansicht, Fortschrittsbalken, Zurück-Button, Mehrfachauswahl wo sinnvoll.
- Dynamik: z. B. „Ein paar Stunden" → Entfernungen > 60 min ausgegraut; „Heute/morgen" → nur Aktivitäten der aktuellen Saison.
- **Scoring statt hartem Ausschluss**: harte Kriterien (Budget, Entfernung, Saison) schließen aus, weiche beeinflussen das Ranking.
- Keine perfekten Treffer → nächstbeste mit Begründung („passt nicht: Budget – ca. 90 € statt < 30 €").
- Logik als **reine Funktionen** ohne DOM → testbar mit Node (`tests/filter.test.mjs`).

## 7. Dateistruktur

```
/
├── index.html                 Single-Page-App
├── css/style.css              Design-Tokens, Komponenten, Responsive
├── js/
│   ├── config.js              Firebase-Web-Konfiguration (öffentlich, kein Geheimnis)
│   ├── firebase.js            Initialisierung von App, Auth, Firestore
│   ├── app.js                 Start, Hash-Router, View-Wechsel
│   ├── auth.js                Login / Logout / Session / Passwort-Reset
│   ├── activities.js          Aktivitätenkatalog (statisch)
│   ├── quiz.js                Fragen & Quiz-UI
│   ├── filter.js              Filter- & Scoring-Logik (pure functions)
│   ├── storage.js             Datenzugriff Firestore + LocalStorage, Export/Import
│   ├── ui.js                  Karten, Detailansicht, Sterne, Toasts
│   └── trip.js                Blind-Trip-Planer
├── firebase/
│   └── firestore.rules        Security Rules
├── assets/images/
├── tests/
├── docs/ARCHITECTURE.md
├── README.md
└── .gitignore
```

Native ES-Module, kein Build-Schritt. Firebase JS SDK (modular) wird mit **gepinnter Version** von `www.gstatic.com/firebasejs/` geladen. Alle Pfade relativ; Hash-Routing (`#/finder`, `#/activity/wimsener-hoehle`) → kein 404-Problem auf GitHub Pages.

## 8. Design

Dark Mode, Dunkelgrün (`#0f2a1f`/`#1f4d3a`), Schwarz, Anthrazit, Akzent Moosgrün. Große Display-Typo, Vollbild-Hero mit Naturfoto, abgerundete Karten, dezente Animationen, `prefers-reduced-motion` wird respektiert. Mobile-first mit Bottom-Navigation.

Bilder von Unsplash/Pexels mit Bildnachweis, passend zur tatsächlichen Aktivität. Ein Prüfskript testet alle Bild-URLs.

## 9. Phasen & Commits

| Phase | Inhalt | Commit |
|---|---|---|
| 1 | Architektur, Grundgerüst | `chore: initialize adventure planner project` |
| 2 | Design, Login (Firebase Auth), Security Rules, Startseite, Navigation | `feat: implement login with firebase auth`, `feat: create responsive landing page` |
| 3 | Adventure Finder | `feat: implement interactive adventure quiz` |
| 4 | Aktivitätendatenbank (33+), Filterlogik + Tests | `feat: add activity database and filtering` |
| 5 | Detailansicht, gemeinsame Bewertungen, Favoriten, Status, Kommentare | `feat: create activity detail views`, `feat: add shared ratings, favorites and comments` |
| 6 | Vorschläge, Matches, Feed; Export/Import | `feat: add suggestions and matches`, `feat: add data export and import` |
| 7 | Blind-Trip-Planer, Tests, Mobile-Feinschliff | `feat: add trip planning section`, `style: optimize mobile experience`, `test: validate application functionality` |
| 8 | README, GitHub Pages | `docs: add setup and deployment instructions` |

## 10. Firebase-Einrichtung (vor Phase 2)

1. Firebase-Konsole → Projekt wählen (bestehend oder neu).
   ⚠️ Bei einem **bestehenden Projekt**: Firestore Security Rules gelten für die gesamte Datenbank. Wenn dort schon andere Daten/Regeln liegen, werden sie durch unsere Regeln ersetzt → dann lieber ein neues Projekt anlegen.
2. *Build → Authentication → Sign-in method*: **E-Mail/Passwort** aktivieren.
3. *Authentication → Settings → User actions*: **„Enable create (sign-up)" deaktivieren**.
4. *Authentication → Settings → Authorized domains*: **`nilsbe006.github.io`** hinzufügen.
5. *Authentication → Users → Add user*: Accounts für Nils und Johannes anlegen. Die angezeigte **User UID** beider Accounts notieren.
6. *Build → Firestore Database*: Datenbank erstellen (Standort möglichst `eur3` oder `europe-west3`, Produktionsmodus).
7. In Firestore Collection `members` anlegen mit zwei Dokumenten, Dokument-ID = jeweilige UID, Feld `displayName` = „Nils" bzw. „Johannes".
8. *Projekteinstellungen → Allgemein → Meine Apps*: Web-App (`</>`) registrieren und das `firebaseConfig`-Objekt kopieren.
9. Security Rules aus `firebase/firestore.rules` (kommt in Phase 2) einfügen und veröffentlichen.
