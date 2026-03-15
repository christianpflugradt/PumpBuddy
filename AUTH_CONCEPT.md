# PumpBuddy Authentifizierungskonzept (verbindliche Zielbeschreibung für Umsetzung)

## Zweck dieses Dokuments

Dieses Dokument beschreibt das **verbindliche Zielbild** für die Authentifizierung von PumpBuddy, so dass daraus durch einen AI-Agenten konkrete Backlog-Items und Umsetzungsaufgaben abgeleitet werden können.

Der Fokus liegt auf:

- eindeutiger Architekturentscheidung
- klaren Datenmodellvorgaben
- definiertem Login- und Session-Verhalten
- browser- und PWA-tauglicher Integration
- späterer Mehrnutzerfähigkeit ohne erneute Datenmodelländerung

Dieses Dokument ist absichtlich konkret formuliert.  
Wo etwas noch nicht sofort umgesetzt werden muss, wird das explizit als **späterer Ausbau** markiert.

---

# 1. Zielarchitektur

PumpBuddy ist zunächst:

- private Web-App / PWA
- Backend in Rust
- Frontend im Browser / als PWA
- Deployment auf eigenem Server
- aktuell genau ein realer Nutzer
- später potenziell mehrere Nutzer

## Verbindliche Entscheidung

Die Authentifizierung wird wie folgt umgesetzt:

**Access Key nur für den Login verwenden -> danach serverseitige Session -> Browser/PWA hält nur ein Session-Cookie.**

Das bedeutet ausdrücklich:

- Der **Access Key** wird **nicht** für jede API-Anfrage mitgesendet.
- Der **Access Key** wird **nicht** dauerhaft im Frontend gespeichert.
- Das Frontend arbeitet nach erfolgreichem Login nur noch mit einem **Session-Cookie**.
- Die Identität des Users wird bei jeder Anfrage **ausschließlich serverseitig aus der Session abgeleitet**.

---

# 2. Zentrale Sicherheits- und Architekturprinzipien

## 2.1 Identität und Zugangsmittel sind getrennt

Ein User ist nicht sein Access Key.

Deshalb werden getrennte Konzepte modelliert:

- `users`
- `user_secrets`
- `sessions`

Ziel:

- User-Identität bleibt stabil
- Access Keys können rotiert oder widerrufen werden
- mehrere Sessions pro User sind möglich
- späterer Ausbau zu echtem Mehrnutzerbetrieb bleibt sauber möglich

## 2.2 Login-Name wird von Anfang an im Datenmodell berücksichtigt

Auch wenn in Phase 1 nur ein realer Nutzer existiert und der Login-Name zunächst **nicht im Login-Formular verwendet** wird, wird das Feld **von Anfang an im Datenmodell** aufgenommen.

Begründung:

- spätere Erweiterung auf echten Mehrnutzerbetrieb ohne erneute Datenmodellmigration
- saubere Trennung zwischen Identität und Geheimnis
- spätere Einführung von `login_name + access_key` wird erleichtert

## 2.3 Der Access Key ist ein menschliches Login-Geheimnis

Der UI-Begriff lautet:

**Access Key**

Der Access Key wird wie ein Passwort behandelt:

- nur zum Login verwendet
- serverseitig nur als Hash gespeichert
- nie im Klartext in der Datenbank gespeichert
- bei Rotation neu erzeugt
- optional später durch User änderbar

## 2.4 Argon2id ist verpflichtend

Für das Hashing des Access Keys ist **Argon2id** zu verwenden.

Es wird **keine separate Salt-Spalte** benötigt, wenn das verwendete Argon2-Format Salt und Parameter im gespeicherten Hash bereits enthält.

Verbindliche Aussage:

- `secret_hash` speichert den **vollständig kodierten Argon2id-Hash**
- dieser enthält Algorithmus, Parameter, Salt und Hashwert

## 2.5 Das Frontend speichert keine Auth-Geheimnisse selbst

Nicht zulässig:

- `localStorage` für Auth-Token
- `sessionStorage` für Auth-Token
- IndexedDB für Access Key
- dauerhafter App-State mit Access Key
- Bearer-Token-Ansatz im Frontend für diesen Use Case

Zulässig:

- Browser / Betriebssystem / Passwortmanager dürfen Zugangsdaten selbst speichern
- das ist ausdrücklich **nicht** dasselbe wie app-seitige Speicherung

---

# 3. Verbindliches Datenmodell

## 3.1 Tabelle `users`

Pflichtfelder:

- `id` (UUID, Primärschlüssel)
- `login_name` (nullable in Phase 1, später unique aktivierbar)
- `display_name` (nicht-null)
- `created_at` (timestamp with time zone)
- `disabled_at` (nullable)

Empfehlungen:

- `id` serverseitig erzeugen
- `login_name` in Phase 1 bereits befüllen möglich, aber Login verwendet es noch nicht zwingend
- `display_name` dient der Anzeige in UI und Logs

## 3.2 Tabelle `user_secrets`

Pflichtfelder:

- `id` (UUID oder bigserial)
- `user_id` (FK -> `users.id`)
- `secret_hash` (Argon2id encoded string)
- `label` (nullable; z. B. `primary`)
- `created_at`
- `revoked_at` (nullable)
- `last_used_at` (nullable)

Optional:

- `rotated_by_user_id` (nullable)
- `rotation_reason` (nullable)

Regeln:

- Pro User kann es historisch mehrere Secrets geben.
- In Phase 1 reicht funktional genau **ein aktives Secret**.
- Ein Secret ist aktiv, wenn `revoked_at IS NULL`.
- Der Access Key selbst wird niemals gespeichert oder geloggt.

## 3.3 Tabelle `sessions`

Pflichtfelder:

- `id` (UUID)
- `user_id` (FK -> `users.id`)
- `session_token_hash`
- `created_at`
- `last_seen_at`
- `idle_expires_at`
- `absolute_expires_at`
- `revoked_at` (nullable)
- `replaced_by_session_id` (nullable, FK -> `sessions.id`)

Empfohlene Zusatzfelder:

- `user_agent` (nullable)
- `ip_address` (nullable oder anonymisiert / gekürzt)
- `device_label` (nullable)
- `revoke_reason` (nullable)

## 3.4 Wichtige Modellregeln

### Mehrere Sessions pro User sind erlaubt
Ein User darf gleichzeitig auf mehreren Geräten angemeldet sein.

Beispiele:

- iPhone PWA
- Desktop-Browser
- Tablet

### Sessions bleiben historisch erhalten
Abgelaufene oder widerrufene Sessions werden **nicht sofort gelöscht**.

Stattdessen werden sie als historischer Datensatz erhalten, damit Nachvollziehbarkeit möglich bleibt.

### Sessions werden später automatisiert bereinigt
Es soll eine regelmäßige Aufräumlogik geben, die alte Session-Historie entfernt.

Empfehlung für spätere Bereinigung:

- widerrufene oder abgelaufene Sessions nach **90 Tagen** löschen
- optional länger behalten, wenn Audit/Forensik später wichtiger wird

Für Phase 1 genügt:
- Datensatz behalten
- späteren Cleanup als separates Backlog-Item vorsehen

---

# 4. Login-Identifikation: Phase 1 vs. später

## 4.1 Phase 1 (jetzt)
Login erfolgt mit:

- `access_key`

Der `login_name` existiert bereits im Datenmodell, wird aber im Login-Prozess zunächst **noch nicht verwendet**.

Das ist für eine Single-User-Version zulässig.

## 4.2 Spätere Mehrnutzerphase
Login erfolgt mit:

- `login_name`
- `access_key`

Begründung:

Ein Salt schützt den Hash, löst aber **nicht** das Identitätsproblem.

Selbst wenn zwei User denselben Access Key hätten:

- die gespeicherten Hashes wären unterschiedlich
- aber beim Login nur mit Secret könnte der Server nicht eindeutig wissen, welcher User gemeint ist

Darum ist `login_name` im Datenmodell verpflichtend, auch wenn er zunächst noch nicht verwendet wird.

---

# 5. Session-Modell

## 5.1 Verbindliche Session-Strategie

Es werden **opaque server-side sessions** verwendet.

Das bedeutet:

- der Browser erhält einen zufälligen Session-Token
- die Datenbank speichert nur den Hash dieses Tokens
- im Cookie liegt kein JWT und kein Access Key
- das Frontend interpretiert den Session-Inhalt nicht selbst

## 5.2 Cookie-Konfiguration

Empfohlenes Cookie:

```http
Set-Cookie: __Host-pb_session=<opaque-random-token>; Path=/; Secure; HttpOnly; SameSite=Strict
```

Diese Eigenschaften sind verpflichtend:

- `Secure`
- `HttpOnly`
- `SameSite=Strict`
- `Path=/`

Cookie-Name:

- empfohlen: `__Host-pb_session`

## 5.3 Was im Cookie ausdrücklich nicht liegen darf

Nicht zulässig im Cookie:

- Access Key
- `user_id`
- `login_name`
- App-seitige Rolleninformationen
- ein “eingeloggt=true”-Flag

---

# 6. Session-Lebensdauer und Timeouts

## 6.1 Verbindliche Werte

### Idle Timeout
**7 Tage**

Definition:

Wenn eine Session **7 Tage lang nicht verwendet** wurde, ist sie nicht mehr gültig.

Technische Abbildung:

- `idle_expires_at`
- bei erfolgreicher authentifizierter Nutzung wird `last_seen_at` aktualisiert
- `idle_expires_at` wird entsprechend weitergeschoben

### Absolute Lifetime
**90 Tage**

Definition:

Eine Session endet spätestens **90 Tage nach Erstellung**, auch wenn sie aktiv genutzt wurde.

Technische Abbildung:

- `absolute_expires_at = created_at + 90 Tage`
- dieser Wert wird nicht verschoben

## 6.2 Gültigkeitsregel

Eine Session ist nur gültig, wenn:

- `revoked_at IS NULL`
- `now < idle_expires_at`
- `now < absolute_expires_at`

## 6.3 Warum diese Werte?

- 7 Tage Idle Timeout passt zum realen Nutzungsverhalten einer Fitness-App
- 90 Tage Absolute Lifetime verhindert unbegrenzt langlebige Sessions
- Komfort bleibt hoch
- Sicherheitsniveau bleibt für das Szenario angemessen

---

# 7. Verhalten bei Login, Logout und Reauthentifizierung

## 7.1 Normaler Login ohne bestehende gültige Session

Wenn keine gültige Session existiert:

1. User gibt Access Key ein
2. Backend prüft gegen aktives Secret
3. bei Erfolg wird **eine neue Session angelegt**
4. Session-Cookie wird gesetzt
5. vorhandene frühere Sessions auf anderen Geräten bleiben unberührt

Wichtig:

- Login auf Gerät A widerruft **nicht** automatisch Sessions auf Gerät B
- mehrere parallele Sessions sind erlaubt

## 7.2 Logout

Beim Logout:

1. aktuelle Session wird über Cookie identifiziert
2. diese Session wird widerrufen:
   - `revoked_at = now`
   - optional `revoke_reason = 'logout'`
3. Cookie wird gelöscht

Wichtig:

- nur die **aktuelle Session** wird widerrufen
- andere Sessions desselben Users bleiben aktiv

## 7.3 Reauthentifizierung

Reauthentifizierung bedeutet:

Ein User hat bereits eine gültige Session, muss sich aber erneut mit Access Key bestätigen.

Das ist in Phase 1 voraussichtlich noch **kein eigener UI-Flow**, soll aber serverseitig und konzeptionell sauber beschrieben sein.

### Verbindliches Verhalten bei Reauthentifizierung

Wenn Reauth erfolgreich durchgeführt wird:

1. aktuelle Session wird widerrufen
2. neue Session wird erzeugt
3. alte Session erhält:
   - `revoked_at = now`
   - `revoke_reason = 'reauth_replaced'`
   - `replaced_by_session_id = <neue_session_id>`
4. neue Session wird per Cookie gesetzt

Das bedeutet:

- Reauth ersetzt **die aktuelle Session**
- andere Sessions auf anderen Geräten bleiben bestehen
- Session-Historie bleibt nachvollziehbar

## 7.4 Session-Ablauf

Wenn eine Session abläuft, weil:

- Idle Timeout erreicht wurde oder
- Absolute Lifetime erreicht wurde,

dann gilt:

- Session wird bei der nächsten Prüfung als ungültig behandelt
- Cookie kann serverseitig als ungültig betrachtet und clientseitig gelöscht werden
- Frontend erhält `401 Unauthorized`
- Frontend zeigt Login-Screen

Optional:
- Session kann beim Erkennen des Ablaufes zusätzlich als logisch beendet markiert werden
- z. B. `revoke_reason = 'expired_idle'` oder `expired_absolute`
- `revoked_at` muss dafür nicht zwingend gesetzt werden, ist aber zulässig, wenn ein einheitliches Modell gewünscht ist

**Empfehlung für Einfachheit:**
- abgelaufene Sessions nicht nachträglich aktiv “widerrufen”
- Gültigkeit rein über Zeitregeln + `revoked_at`
- optional später einen Cleanup/Markierungsjob ergänzen

---

# 8. Aufbewahrung und Bereinigung von Sessions

## 8.1 Historie behalten

Sessions sollen nicht sofort gelöscht werden, wenn sie:

- abgelaufen sind
- widerrufen wurden
- durch Reauth ersetzt wurden

Begründung:

- bessere Nachvollziehbarkeit
- hilfreich für Debugging
- später nützlich für Geräteübersicht / Sessionverwaltung

## 8.2 Späterer Cleanup-Job

Es soll ein späterer automatisierter Cleanup-Mechanismus vorgesehen werden.

Empfohlene Regel:

Lösche Sessions, wenn:

- `revoked_at` gesetzt ist und älter als 90 Tage
- oder `absolute_expires_at` älter als 90 Tage ist

Das ist zunächst ein **späteres Backlog-Item**, kein Muss für den allerersten Auth-MVP.

---

# 9. Backend-Endpunkte

## 9.1 Pflicht-Endpunkte für Phase 1

### `POST /auth/login`

Request-Body:

```json
{
  "access_key": "plain-text-secret"
}
```

Verhalten:

1. aktiven User bestimmen (Phase 1: genau ein aktiver User)
2. aktives Secret dieses Users laden
3. Access Key gegen `secret_hash` mit Argon2id prüfen
4. bei Erfolg:
   - neue Session erzeugen
   - Session-Token generieren
   - nur Hash des Session-Tokens speichern
   - Cookie setzen
   - `last_used_at` am Secret aktualisieren
5. Erfolg zurückgeben

Fehlerfälle:

- `401 Unauthorized` bei ungültigem Access Key
- keine Information preisgeben, ob User existiert oder nicht

### `GET /auth/session`

Zweck:

- Frontend prüft beim Start, ob eine gültige Session existiert

Verhalten:

1. Session-Cookie lesen
2. Session-Token hashen
3. Session in DB suchen
4. Gültigkeit prüfen
5. bei gültiger Session:
   - `last_seen_at` aktualisieren
   - `idle_expires_at` weiterschieben
   - minimale User-Info zurückgeben
6. bei ungültiger Session:
   - `401 Unauthorized`

Response bei Erfolg, Beispiel:

```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "display_name": "Chris"
  }
}
```

### `POST /auth/logout`

Verhalten:

1. aktuelle Session aus Cookie auflösen
2. Session widerrufen
3. Cookie löschen
4. `204 No Content` oder `200 OK`

## 9.2 Spätere Endpunkte

Nicht zwingend für Phase 1, aber mitdenken:

- `POST /auth/reauth`
- `GET /auth/sessions`
- `DELETE /auth/sessions/:id`
- `POST /auth/logout-all`
- `POST /auth/rotate-access-key`

---

# 10. Frontend-Verhalten

## 10.1 Startverhalten

Beim App-Start:

1. `GET /auth/session`
2. falls gültig:
   - App normal initialisieren
3. falls `401`:
   - Login-Screen anzeigen

## 10.2 Login-Screen

Für Phase 1:

- ein Eingabefeld für `Access Key`
- Feldtyp: Passwortfeld
- Copy/Paste erlauben
- optional Show/Hide Toggle
- Formularstruktur so bauen, dass Passwortmanager gut funktionieren

Wichtig:

- kein `login_name` im UI erforderlich in Phase 1
- `login_name` existiert nur schon im Datenmodell

## 10.3 Verhalten bei `401 Unauthorized`

Wenn ein API-Call `401` liefert:

1. Frontend behandelt die Session als ungültig
2. lokale App-Ansicht kehrt zur Login-Ansicht zurück
3. optional Hinweis:
   - „Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.“

## 10.4 Frontend speichert keinen Access Key

Das Frontend darf den Access Key nicht selbst persistent ablegen.

Wenn der Nutzer den Access Key komfortabel wiederverwenden möchte, ist das Aufgabe von:

- iCloud Keychain
- Browser Password Manager
- anderem Betriebssystem-/Browser-AutoFill

---

# 11. iPhone, PWA, AutoFill, Face ID

## 11.1 Gewünschtes Komfortziel

Die App soll auf iPhone als PWA angenehm nutzbar sein, ohne dass der Access Key ständig manuell eingegeben werden muss.

## 11.2 Technisch realistische Lösung

Die App selbst erzwingt **nicht direkt** Face ID.

Stattdessen:

- Login-Formular sauber gestalten
- HTTPS verwenden
- Passwortmanager-kompatibles Markup verwenden
- Browser / iOS / iCloud Keychain können dann gespeicherte Credentials per AutoFill anbieten
- biometrische Freigabe wird durch das Betriebssystem bzw. den Passwortmanager gesteuert

## 11.3 Verbindliche Schlussfolgerung

- Die App **soll** Passwortmanager-freundlich implementiert werden.
- Die App **kann nicht garantieren**, dass Face ID immer verwendet wird.
- Ob Face ID beim Ausfüllen eingesetzt wird, entscheidet das Apple-Ökosystem des Nutzers.

---

# 12. Access-Key-Rotation

## 12.1 Administrativer Ansatz

Ein Admin-/Owner-Skript im Backend-Container ist zulässig.

Ziel:

- neuer Access Key kann serverseitig erzeugt und gesetzt werden
- Klartext wird nur einmalig ausgegeben
- DB speichert nur den neuen Hash

## 12.2 Verbindlicher Ablauf bei Rotation

1. neuen Access Key erzeugen
2. neuen Argon2id-Hash erzeugen
3. neuen Datensatz in `user_secrets` anlegen
4. altes Secret widerrufen:
   - `revoked_at = now`
5. optional alle Sessions des Users widerrufen

## 12.3 Empfehlung für Phase 1

Bei Access-Key-Rotation sollen **alle Sessions des betroffenen Users widerrufen** werden.

Begründung:

- einfacher
- sicher
- eindeutiges Verhalten

Dann gilt:

- nach Rotation ist neue Anmeldung erforderlich
- bestehende Session-Cookies werden bei nächster Anfrage ungültig

---

# 13. Serverseitige Autorisierung

## 13.1 Pflichtregel

Die `user_id` wird **nie** aus dem Frontend vertraut.

Stattdessen immer:

`session_cookie -> session lookup -> user_id`

Nicht zulässig:

- `user_id` im Request-Body als vertrauenswürdige Quelle
- clientseitige Auth-Flags als Sicherheitsgrundlage

## 13.2 Konsequenz für das restliche Datenmodell

Alle fachlichen Tabellen dürfen später eine `user_id` tragen.

Diese `user_id` wird bei Schreib- und Lesezugriffen serverseitig aus der gültigen Session abgeleitet.

---

# 14. Logging und Datenschutz

## 14.1 Nicht loggen

Nicht in Logs schreiben:

- Access Key
- Session-Token im Klartext
- vollständige Geheimnisse
- Debug-Ausgaben mit Auth-Headers oder Cookies

## 14.2 Zulässige Logdaten

Zulässig, falls sinnvoll:

- Session-ID
- User-ID
- Eventtyp
- Zeitstempel
- gekürzte / anonymisierte IP
- User-Agent

---

# 15. Umsetzungsreihenfolge / Backlog-Struktur

## 15.1 Auth-MVP

1. **DB-Schema für `users`, `user_secrets`, `sessions` anlegen**
2. **`login_name` von Anfang an im Schema vorsehen**
3. **Argon2id-Hashing für Access Keys integrieren**
4. **Login-Endpunkt `POST /auth/login` implementieren**
5. **serverseitige Session-Erzeugung implementieren**
6. **Session-Cookie sicher setzen**
7. **`GET /auth/session` implementieren**
8. **`POST /auth/logout` implementieren**
9. **Frontend-Login-Screen implementieren**
10. **Frontend-Session-Check beim Start implementieren**
11. **Frontend-Handling für `401 Unauthorized` implementieren**
12. **Idle Timeout (7 Tage) und Absolute Lifetime (90 Tage) implementieren**

## 15.2 Danach sinnvoll

13. **Admin-Skript für Access-Key-Rotation bauen**
14. **Session-Historie sauber mit `revoke_reason` und `replaced_by_session_id` modellieren**
15. **optionalen Cleanup-Job für alte Sessions bauen**
16. **Passwortmanager-/AutoFill-Markup im Login-Screen optimieren**

## 15.3 Späterer Ausbau

17. **`login_name` im Login-UI aktivieren**
18. **Reauth-Endpunkt und Reauth-UI ergänzen**
19. **Session-Liste / Geräteverwaltung ergänzen**
20. **Logout aller Sessions ergänzen**
21. **Passkeys / WebAuthn evaluieren**

---

# 16. Verbindliche Kurzfassung für den AI-Agenten

## Architektur
- Session-basierte Web-Authentifizierung
- kein Bearer-Token-Ansatz im Frontend
- kein Access Key in `localStorage`

## Hashing
- Access Keys mit Argon2id hashen
- `secret_hash` speichert vollständigen kodierten Hash
- keine separate Salt-Spalte

## Datenmodell
- `users`
- `user_secrets`
- `sessions`
- `login_name` von Anfang an im Schema enthalten, aber Phase 1 noch nicht im Login verwendet

## Session-Regeln
- mehrere Sessions pro User erlaubt
- Session-Historie zunächst behalten
- Idle Timeout: 7 Tage
- Absolute Lifetime: 90 Tage
- Logout widerruft nur aktuelle Session
- Reauth ersetzt aktuelle Session durch neue Session
- Access-Key-Rotation widerruft alle Sessions des Users

## Frontend
- Login mit Access Key
- Session-Check beim App-Start
- bei `401` zurück zum Login
- Frontend speichert Access Key nicht selbst
- Passwortmanager/AutoFill sollen gut unterstützt werden

---

# 17. Offene Punkte mit aktueller Empfehlung

## 17.1 Soll `login_name` in Phase 1 schon befüllt werden?
Empfehlung: **ja**, auch wenn er noch nicht aktiv genutzt wird.

## 17.2 Soll es sofort einen Cleanup-Job geben?
Empfehlung: **nein**, zunächst nur Backlog-Item. Historie erstmal behalten.

## 17.3 Soll Reauth in Phase 1 schon eine eigene UI haben?
Empfehlung: **nein**, zunächst nicht nötig. Architektur aber jetzt schon entsprechend modellieren.

---

# 18. Ergebnis

Dieses Konzept ist für PumpBuddy aktuell der beste Trade-off aus:

- Einfachheit
- Sicherheit
- PWA-Tauglichkeit
- späterer Mehrnutzerfähigkeit
- sauberer Erweiterbarkeit

Es ist bewusst so geschnitten, dass:

- Phase 1 schnell umsetzbar bleibt
- spätere Erweiterungen nicht zu einem Architekturbruch führen
- der AI-Agent daraus konkrete, voneinander trennbare Backlog-Items erzeugen kann
