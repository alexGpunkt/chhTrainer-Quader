/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           KlassenMonitor – Tracker-Snippet v1.0             ║
 * ║  Einbinden in jede Schüler-App (HTML/JS).                   ║
 * ║  Sendet alle 30 Sek. einen "Ping" an Supabase.              ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ANLEITUNG:
 *  1. Die drei Variablen unten (SUPABASE_URL, SUPABASE_KEY, APP_NAME) anpassen.
 *  2. Diese Datei speichern als "tracker.js"
 *  3. In jede App-HTML-Datei einbinden:
 *       <script src="tracker.js"></script>
 *     → Am besten direkt vor dem schließenden </body>-Tag.
 *
 *  Optional: STUDENT_NAME_PROMPT = true → Schüler werden beim Start
 *  nach ihrem Namen gefragt (erscheint dann im Dashboard).
 */

// ════════════════════════════════════════════════════════════════
// ▸ HIER ANPASSEN
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://sntbedutlztfsyzlxqfl.supabase.co/rest/v1/';  	// ← anpassen
const SUPABASE_KEY  = 'sb_publishable_nWFLSFS56Pg6QLeCz1IC1Q_3P7KqD80';         // ← anpassen
const APP_NAME      = 'Trainer Quader & Würfel';                      		// ← App-Name

// Optional: true = Schüler gibt beim Start seinen Namen ein
const STUDENT_NAME_PROMPT = false;

// Ping-Intervall in Millisekunden (Standard: 30 Sekunden)
const PING_INTERVAL_MS = 30000;

// ════════════════════════════════════════════════════════════════
// ▸ KEIN WEITERER EINGRIFF NÖTIG AB HIER
// ════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // Eindeutige Session-ID generieren
  function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  // Session-ID für diesen Tab/Aufruf erzeugen
  const SESSION_ID = generateSessionId();

  // Optional: Schülername abfragen
  let studentName = '';
  if (STUDENT_NAME_PROMPT) {
    studentName = prompt('Gib deinen Namen oder Kürzel ein:') || '';
  }

  // ── API-Aufruf ─────────────────────────────────────────────────
  async function sendPing(action) {
    const url = `${SUPABASE_URL}/rest/v1/active_sessions`;

    const body = {
      session_id:   SESSION_ID,
      app_name:     APP_NAME,
      student_name: studentName || null,
      last_seen:    new Date().toISOString(),
      action:       action  // 'ping' | 'leave'
    };

    try {
      if (action === 'ping') {
        // Upsert: Eintrag anlegen oder aktualisieren
        await fetch(url, {
          method: 'POST',
          headers: {
            'apikey':          SUPABASE_KEY,
            'Authorization':   `Bearer ${SUPABASE_KEY}`,
            'Content-Type':    'application/json',
            'Prefer':          'resolution=merge-duplicates'
          },
          body: JSON.stringify(body)
        });
      } else if (action === 'leave') {
        // Beim Verlassen: last_seen weit in der Vergangenheit setzen
        // → Dashboard erkennt Schüler sofort als inaktiv
        await fetch(`${url}?session_id=eq.${SESSION_ID}`, {
          method: 'PATCH',
          headers: {
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type':  'application/json'
          },
          body: JSON.stringify({ last_seen: '2000-01-01T00:00:00Z' })
        });
      }
    } catch (e) {
      // Fehler still ignorieren – kein Popup für Schüler
      console.debug('[KlassenMonitor] Ping-Fehler:', e.message);
    }
  }

  // ── Start ──────────────────────────────────────────────────────
  // Erster Ping sofort beim Laden
  sendPing('ping');

  // Regelmäßige Pings
  const intervalId = setInterval(() => sendPing('ping'), PING_INTERVAL_MS);

  // Abmelden wenn Tab geschlossen oder Seite verlassen wird
  window.addEventListener('beforeunload', () => {
    sendPing('leave');
    clearInterval(intervalId);
  });

  // Abmelden bei Tab-Wechsel (Page Visibility API)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      sendPing('leave');
    } else {
      sendPing('ping');
    }
  });

  console.log(`[KlassenMonitor] Tracker aktiv → App: "${APP_NAME}" | Session: ${SESSION_ID}`);
})();
