/**
 * KlassenMonitor – Tracker-Snippet v1.1
 * Sendet alle 30 Sekunden einen Ping an Supabase.
 * Mit Schülername + stabiler client_id.
 */

// ════════════════════════════════════════════════════════════════
// ▸ HIER ANPASSEN
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://sntbedutlztfsyzlxqfl.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_nWFLSFS56Pg6QLeCz1IC1Q_3P7KqD80';
const APP_NAME      = 'Trainer Quader & Würfel';

// true = falls kein Name aus der App kommt, fragt tracker.js selbst nach
const STUDENT_NAME_PROMPT = true;

const PING_INTERVAL_MS = 30000;

// ════════════════════════════════════════════════════════════════
// ▸ AB HIER NORMALERWEISE NICHTS MEHR ANPASSEN
// ════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const STORAGE_CLIENT_ID = 'km_client_id';
  const STORAGE_NAME = 'km_student_name';

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function createId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return 'id_' + Math.random().toString(36).slice(2) + '_' + Date.now();
  }

  // Stabile Geräte-/Browserkennung
  let CLIENT_ID = localStorage.getItem(STORAGE_CLIENT_ID);

  if (!CLIENT_ID) {
    CLIENT_ID = createId();
    localStorage.setItem(STORAGE_CLIENT_ID, CLIENT_ID);
  }

  // Stabile Session-ID pro App und Browser
  // Dadurch wird derselbe Schüler in derselben App nicht mehrfach gezählt.
  const SESSION_ID = 'sess_' + slugify(APP_NAME) + '_' + CLIENT_ID;

  // Schülername holen:
  // 1. aus der Lernanwendung: window.KM_STUDENT_NAME
  // 2. aus localStorage
  // 3. falls erlaubt: per prompt abfragen
  let studentName = window.KM_STUDENT_NAME || localStorage.getItem(STORAGE_NAME) || '';

  if ((!studentName || studentName.trim().length < 2) && STUDENT_NAME_PROMPT) {
    while (!studentName || studentName.trim().length < 2) {
      studentName = prompt('Gib deinen Namen oder dein Kürzel ein:') || '';
      studentName = studentName.trim();
    }

    localStorage.setItem(STORAGE_NAME, studentName);
    window.KM_STUDENT_NAME = studentName;
  }

  studentName = studentName.trim();

  async function sendPing(action) {
    const url = `${SUPABASE_URL}/rest/v1/active_sessions?on_conflict=session_id`;

    const body = {
      session_id: SESSION_ID,
      client_id: CLIENT_ID,
      app_name: APP_NAME,
      student_name: studentName || null,
      last_seen: new Date().toISOString(),
      action: action
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[KlassenMonitor] Supabase-Fehler:', res.status, errText);
      } else {
        console.debug('[KlassenMonitor] Ping gesendet:', action, SESSION_ID, studentName);
      }

    } catch (e) {
      console.error('[KlassenMonitor] Ping-Fehler:', e);
    }
  }

  async function sendLeave() {
    const url = `${SUPABASE_URL}/rest/v1/active_sessions?session_id=eq.${encodeURIComponent(SESSION_ID)}`;

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          last_seen: '2000-01-01T00:00:00Z',
          action: 'leave'
        }),
        keepalive: true
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[KlassenMonitor] Leave-Fehler:', res.status, errText);
      }

    } catch (e) {
      console.error('[KlassenMonitor] Leave-Fehler:', e);
    }
  }

  // Start
  sendPing('ping');

  const intervalId = setInterval(() => {
    if (!document.hidden) {
      sendPing('ping');
    }
  }, PING_INTERVAL_MS);

  window.addEventListener('beforeunload', () => {
    sendLeave();
    clearInterval(intervalId);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      sendLeave();
    } else {
      sendPing('ping');
    }
  });

  console.log(
    `[KlassenMonitor] Tracker aktiv → App: "${APP_NAME}" | Schüler: "${studentName || '—'}" | Client: ${CLIENT_ID} | Session: ${SESSION_ID}`
  );
})();
