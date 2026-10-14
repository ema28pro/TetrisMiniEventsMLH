/* ============================================================================
 *  DISCORD SCRAPER  —  Mini Eventos TETR.IO
 * ----------------------------------------------------------------------------
 *  Se ejecuta en la CONSOLA de Discord (discord.com/app), logueado y dentro
 *  del servidor del evento.
 *
 *  MODOS
 *  ---------------------------------------------------------------------------
 *   · "avatars"  → descarga SOLO las fotos de perfil de todos los que
 *                  escribieron (avatares.json).  ← RECOMENDADO AHORA
 *   · "mentions" → descarga solo lo que te menciona / tú escribes.
 *   · "full"     → descarga el canal completo.
 *
 *  RECORRIDO
 *  ---------------------------------------------------------------------------
 *  Va del mensaje MÁS RECIENTE hacia ATRÁS (de abajo hacia arriba) y se detiene
 *  cuando llega a la hora indicada en AFTER_TIME.
 *
 *  CÓMO USARLO
 *  ---------------------------------------------------------------------------
 *   1. Abre Discord en el navegador y entra al canal del evento.
 *   2. Pega este script completo en la consola (F12 → Consola) y Enter.
 *   3. Se descargará un .json. Ponlo en la carpeta  raw/  del proyecto.
 *   4. En el proyecto ejecuta:  npm run import
 * ========================================================================== */

(async () => {
  /* ==========================================================================
   *  CONFIGURACIÓN
   * ======================================================================== */
  const CHANNEL_ID = "1156291986509267105";   // ID del canal a escanear
  const FROM_MSG_ID = "";                      // empieza en este mensaje (vacío = el más reciente)
  const UNTIL_MSG_ID = "";                     // detente al llegar a este mensaje (vacío = sin límite)
  const AFTER_TIME = "12:00";                  // NO bajes de esta hora (vacío = sin límite)
  const BEFORE_TIME = "";                      // opcional: ignora lo posterior a esta hora
  const MODE = "avatars";                      // "avatars" | "mentions" | "full"
  const OUTPUT_NAME = "avatares.json";         // nombre del archivo descargado

  // Opcional: si la lectura automática del token falla, pega aquí tu token
  // (DevTools → Network → cualquier petición a /api/v9/ → header "authorization").
  const TOKEN_MANUAL = "";

  // Tu identidad en Discord (para detectar tus mensajes y respuestas).
  const ME_ALIASES = ["el_ema", "el ema", "!el_ema"];

  // Variantes del nombre a detectar en el texto (modo "mentions").
  const NAME_PATTERN = /\b(?:emaun[a-z]*|emanu[a-z]*|emannu[a-z]*|emmanu[a-z]*|ema)(?:['’][a-z]+)?\b/i;
  const STOPWORDS = ["emb", "embed", "emoji", "emojis", "email", "emails", "emote", "emotes", "empty", "emotion"];

  /* ==========================================================================
   *  FIN DE LA CONFIGURACIÓN
   * ======================================================================== */

  // --- 1. Token de sesión ---------------------------------------------------
  function leerTokenLocal() {
    // (a) Algunos clientes lo dejan en localStorage.
    try {
      const crudo = localStorage.getItem("token");
      if (crudo) {
        const t = JSON.parse(crudo);
        if (typeof t === "string" && t.length > 20) return t;
      }
    } catch (_) { /* ignore */ }

    // (b) Store interno de Discord: cualquier módulo con getToken().
    let encontrado = null;
    try {
      window.webpackChunkDiscord_app.push([
        [Math.random()],
        {},
        (req) => {
          if (!req || !req.c) return;
          for (const id in req.c) {
            const def = req.c[id] && req.c[id].exports && req.c[id].exports.default;
            try {
              if (def && typeof def.getToken === "function") {
                const t = def.getToken();
                if (typeof t === "string" && t.length > 20) { encontrado = t; break; }
              }
            } catch (_) { /* ignore */ }
          }
        },
      ]);
      window.webpackChunkDiscord_app.pop();
    } catch (_) { /* ignore */ }

    return encontrado;
  }

  // Captura el header "authorization" de las peticiones que Discord ya hace.
  // Funciona también en la APP DE ESCRITORIO.
  function tokenDesdeRed(timeoutMs = 15000) {
    return new Promise((resolve) => {
      let listo = false;
      const fin = (t) => { if (!listo) { listo = true; resolve(t); } };

      try {
        const fetchOrig = window.fetch;
        window.fetch = function (...args) {
          try {
            const h = (args[1] || {}).headers;
            let auth = null;
            if (h) {
              auth = (typeof h.get === "function")
                ? (h.get("authorization") || h.get("Authorization"))
                : (h.authorization || h.Authorization);
            }
            if (auth && String(auth).length > 20) fin(String(auth));
          } catch (_) { /* ignore */ }
          return fetchOrig.apply(this, args);
        };
      } catch (_) { /* ignore */ }

      try {
        const setOrig = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
          try {
            if (String(k).toLowerCase() === "authorization" && String(v).length > 20) fin(String(v));
          } catch (_) { /* ignore */ }
          return setOrig.apply(this, arguments);
        };
      } catch (_) { /* ignore */ }

      console.info("… buscando el token de una petición de Discord (si tarda, haz clic en un canal)…");
      setTimeout(() => fin(null), timeoutMs);
    });
  }

  let token = TOKEN_MANUAL || leerTokenLocal();
  if (!token) token = await tokenDesdeRed();

  if (!token) {
    console.error("❌ No pude capturar el token.");
    console.info("Plan B: DevTools → Network → clic en un canal → petición a /api/v9/ → copia el header 'authorization' → pégalo en TOKEN_MANUAL y ejecuta otra vez.");
    return;
  }
  console.log("🔑 Token obtenido.");

  // --- 2. Helpers -----------------------------------------------------------
  const norm = (s) => String(s || "").toLowerCase().trim();
  const isMe = (alias) => ME_ALIASES.some((a) => norm(a) === norm(alias));

  function matchesName(text) {
    if (!text) return false;
    if (STOPWORDS.some((w) => norm(text) === w)) return false;
    return NAME_PATTERN.test(text);
  }

  function avatarUrl(a) {
    if (!a || !a.avatar) return "";
    const ext = String(a.avatar).startsWith("a_") ? "gif" : "webp";
    return `https://cdn.discordapp.com/avatars/${a.id}/${a.avatar}.${ext}?size=64`;
  }

  function localTime(iso) {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // --- 3. Paginar HACIA ATRÁS (de lo más reciente a lo más viejo) -----------
  const messages = [];
  const avatars = {};            // autor → foto real
  const seen = new Set();
  let before = FROM_MSG_ID || null;
  let revisados = 0;

  while (true) {
    const params = new URLSearchParams({ limit: "100" });
    if (before) params.set("before", before);   // mensajes anteriores a `before`

    let res;
    try {
      res = await fetch(`https://discord.com/api/v9/channels/${CHANNEL_ID}/messages?${params}`, {
        headers: { Authorization: token },
      });
    } catch (e) {
      console.error("❌ Error de red:", e);
      break;
    }

    if (!res.ok) {
      console.error("❌ Discord respondió:", res.status, res.statusText);
      break;
    }

    const page = await res.json();
    if (!page || page.length === 0) break;
    revisados += page.length;
    page.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));   // ascendente
    const oldest = page[0];

    for (const m of page) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);

      const author = (m.author && (m.author.global_name || m.author.username)) || "Desconocido";
      const foto = avatarUrl(m.author);
      if (foto && !avatars[author]) avatars[author] = foto;

      // Filtro por hora (aplica a todos los modos, incluido "avatars").
      const t = localTime(m.timestamp);
      if (AFTER_TIME && t < AFTER_TIME) continue;
      if (BEFORE_TIME && t > BEFORE_TIME) continue;

      if (MODE === "avatars") continue;

      const content = m.content || "";
      let replyAuthor = "";
      if (m.referenced_message && m.referenced_message.author) {
        replyAuthor = m.referenced_message.author.global_name || m.referenced_message.author.username || "";
      }

      let tipo = null;
      if (isMe(author)) tipo = "tu_mensaje";
      else if (replyAuthor && isMe(replyAuthor)) tipo = "respuesta_a_ti";
      else if (matchesName(content)) tipo = "mencion_en_chat";

      if (MODE !== "full" && tipo === null) continue;

      messages.push({
        id: m.id,
        autor: author,
        autor_avatar: foto,
        timestamp: m.timestamp,
        hora: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mensaje: content,
        tipo,
      });
    }

    // Siguiente página: los mensajes anteriores al más viejo de esta.
    before = oldest.id;

    // ¿Nos detenemos?
    if (UNTIL_MSG_ID && BigInt(oldest.id) <= BigInt(UNTIL_MSG_ID)) break;
    if (AFTER_TIME && localTime(oldest.timestamp) < AFTER_TIME) break;
    if (page.length < 100) break;

    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\n📊 Mensajes revisados: ${revisados}`);
  console.log(`🖼  Fotos de perfil encontradas: ${Object.keys(avatars).length}`);

  // --- 4. Descargar ---------------------------------------------------------
  const payload = MODE === "avatars" ? avatars : messages;
  console.log(`🎉 Guardados: ${Array.isArray(payload) ? payload.length : Object.keys(payload).length} (modo ${MODE})`);

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = OUTPUT_NAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  console.log(`💾 Descargado: ${OUTPUT_NAME}`);
})();
