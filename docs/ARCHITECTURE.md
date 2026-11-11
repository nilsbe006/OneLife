# ONE LIFE. NO LIMITS. – Technische Architektur

Stand: Phase 8 – fertig umgesetzt. Backend: **Firebase**. Einrichtung & Deployment: siehe [README](../README.md).

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

Die aktuelle Dateistruktur mit Beschreibung jeder Datei steht in der [README](../README.md#projektstruktur). Gegenüber der ursprünglichen Planung kamen hinzu: `store.js` (Firestore-Sync), `social.js`, `lists.js`, `inbox.js`, `feed.js`, `settings.js`, `cards.js`, `catalog.js`, `images.js`, `trip-view.js`, `nav.js`, `util.js` sowie Browser-Tests unter `tests/e2e/`.

Ergänzungen am Datenmodell während der Umsetzung:
- `members/{uid}`: jeder darf sein **eigenes** Dokument lesen (`allow get: if isMe(uid)`), damit die App „nicht freigeschaltet“ von „Regeln fehlen“ unterscheiden kann.
- `ratings` enthält kein Notizfeld; persönliche Gedanken laufen über den gemeinsamen Kommentar-Thread.
- Vorschläge werden mit `where('toUid'|'fromUid', '==', uid)` abgefragt, weil die Regeln nur eigene Vorschläge freigeben.

## 8. Design

Dark Mode, Dunkelgrün (`#0f2a1f`/`#1f4d3a`), Schwarz, Anthrazit, Akzent Moosgrün. Große Display-Typo, Vollbild-Hero mit Naturfoto, abgerundete Karten, dezente Animationen, `prefers-reduced-motion` wird respektiert. Mobile-first mit Bottom-Navigation.

Bilder von Unsplash/Pexels mit Bildnachweis, passend zur tatsächlichen Aktivität. Ein Prüfskript testet alle Bild-URLs.

## 9. Phasen & Commits (umgesetzt)

| Phase | Inhalt | Commits |
|---|---|---|
| 1 | Architektur, Grundgerüst, Wechsel auf Firebase | `chore: initialize adventure planner project`, `docs: switch backend from supabase to firebase` |
| 2 | Login, Security Rules, Startseite, Navigation | `feat: implement login with firebase auth`, `feat: create responsive landing page`, 2× `fix:` Login-Diagnose |
| 3 | Adventure Finder | `feat: implement interactive adventure quiz` |
| 4 | Aktivitäten (37), Filterlogik, Katalog, Details | `feat: add activity database and filtering` |
| 5 | Gemeinsame Bewertungen, Favoriten, Status, Kommentare | `feat: add shared favorites, ratings, comments and status` |
| 6 | Vorschläge, Feed, Export/Import | `feat: add suggestions, activity feed and data export/import` |
| 7 | Trip-Planer, Mobile, Tests | `feat: add trip planning section`, `style: optimize mobile experience`, `test: validate application functionality`, `fix: require 'Weiter' button in adventure finder` |
| 8 | Dokumentation & Deployment | `docs: add setup and deployment instructions` |

## 10. Firebase-Einrichtung

Die Schritt-für-Schritt-Anleitung steht in der [README](../README.md#einrichtung-einmalig).
