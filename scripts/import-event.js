/**
 * ============================================================================
 *  IMPORTADOR DE MENCIONES  •  TETR.IO / MLH  →  data/menciones.json
 * ============================================================================
 *  Junta todos los exports de menciones en UN solo JSON, sin mis propios
 *  mensajes (salvo respuestas hacia mí) y con la foto de perfil de cada autor.
 *
 *  USO
 *  ---------------------------------------------------------------------------
 *    npm run import
 *
 *  AÑADIR UN MINI EVENTO NUEVO
 *  ---------------------------------------------------------------------------
 *    1. Abre Discord, pasa el mouse por encima del canal del evento…
 *       (consigue el ID del canal).
 *    2. Pega `discord_mentions_scraper.js` en la consola de Discord
 *       (MODE = "mentions"). Se descargará un .json con el campo `autor_avatar`.
 *    3. Copia ese .json dentro de `raw/`.
 *    4. Añade sus archivos al array `EVENTS` de este script y vuelve a
 *       ejecutar `npm run import`.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'raw');
const DATA_DIR = path.join(ROOT, 'data');
const DOWNLOADS = 'C:/Users/Fixer/Downloads';
const SHOWCASE_DIR = path.resolve(ROOT, '..', 'MiniEventoShowcase');

/* ---------------------------------------------------------------------------
 *  CONFIGURACIÓN  (añade aquí cada mini evento nuevo)
 * ------------------------------------------------------------------------- */
const EVENTS = [
  {
    id: '2026-10-13-ghw-hacktoberfest-tetris',
    title: 'GHW Hackoberfest • Mini Event Tetris',
    game: 'TETR.IO',
    server: 'Major League Hackking',
    date: '2026-10-13',
    me: '!El_Ema',
    channel: 'mini-event',
    files: [
      'referencias_completas_emanuel.json',
      'mensajes_referencias_emanuel.json',
    ],
    // Mensaje que se muestra fijo en la columna derecha.
    featured: {
      author: 'pasta',
      time: '12:51',
      iso: '2026-10-13T17:51:42.741Z',
      content: 'art',
      image: 'assets/pasta-art.webp',
      reactions: [
        { emoji: '😲', count: 2 },
        { emoji: '♥️', count: 2, me: true },
      ],
    },
  },
];

/* ---------------------------------------------------------------------------
 *  NORMALIZACIÓN
 * ------------------------------------------------------------------------- */
function normalizeKind(tipo) {
  if (tipo === 'tu_mensaje') return 'mine';
  if (tipo === 'respuesta_a_ti') return 'reply';
  if (tipo === 'mencion_en_chat') return 'mention';
  return null;
}

function normalizeMessage(raw) {
  const author = String(raw.autor != null ? raw.autor : '').replace(/^@+/, '').trim();
  return {
    id: String(raw.id != null ? raw.id : ''),
    author: author || 'Desconocido',
    replyTo: raw.referencia_a || raw.respuesta_a || null,
    time: String(raw.hora != null ? raw.hora : ''),
    iso: String(raw.timestamp != null ? raw.timestamp : ''),
    content: String(raw.mensaje != null ? raw.mensaje : ''),
    kind: normalizeKind(raw.tipo),
  };
}

/* ---------------------------------------------------------------------------
 *  UTILIDADES
 * ------------------------------------------------------------------------- */
function hash(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

function normUser(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function dedupById(list) {
  const seen = new Set();
  const out = [];

  for (const item of list) {
    if (!item) continue;
    if (item.id != null) {
      const key = String(item.id);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(item);
  }
  return out;
}

function ensureRaw(file) {
  const rawPath = path.join(RAW_DIR, file);
  if (fs.existsSync(rawPath)) return rawPath;

  const origin = path.join(DOWNLOADS, file);
  if (fs.existsSync(origin)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.copyFileSync(origin, rawPath);
    console.log('  \u21b3 copiado desde Downloads \u2192 raw/' + file);
    return rawPath;
  }
  return null;
}

/* Lee un JSON tolerando BOM (algunos editores lo añaden). */
function readJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

/* ---------------------------------------------------------------------------
 *  FOTOS DE PERFIL
 * ------------------------------------------------------------------------- */
/* 1) Avatares reales capturados por el scraper.
 *    - Desde los mensajes (`autor_avatar`) en cualquier raw/*.json (array).
 *    - O desde un mapa directo  { "Autor": "https://…" }  (ej. avatares.json). */
function buildScrapedAvatars() {
  const map = {};
  if (!fs.existsSync(RAW_DIR)) return map;

  for (const file of fs.readdirSync(RAW_DIR)) {
    if (!file.toLowerCase().endsWith('.json')) continue;

    let parsed;
    try { parsed = readJson(path.join(RAW_DIR, file)); } catch { continue; }

    if (Array.isArray(parsed)) {
      for (const msg of parsed) {
        if (!msg || !msg.autor || !msg.autor_avatar) continue;
        map[String(msg.autor)] = msg.autor_avatar;
      }
    } else if (parsed && typeof parsed === 'object') {
      for (const [nombre, url] of Object.entries(parsed)) {
        if (typeof url === 'string' && /^https?:\/\//.test(url)) map[nombre] = url;
      }
    }
  }
  return map;
}

/* 2) Avatares del museo MLH (respaldo para quien no se haya scrapeado). */
function buildShowcaseAvatars() {
  const map = {};
  const candidates = ['artworks.json', 'data.js'];

  for (const name of candidates) {
    const file = path.join(SHOWCASE_DIR, name);
    if (!fs.existsSync(file)) continue;

    let entries = [];
    const text = fs.readFileSync(file, 'utf8');

    if (name.endsWith('.json')) {
      try { entries = JSON.parse(text); } catch { entries = []; }
    } else {
      const match = text.match(/EMBEDDED_ARTWORKS\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        try { entries = JSON.parse(match[1]); } catch { entries = []; }
      }
    }

    for (const art of entries) {
      if (!art || !art.username || !art.avatar) continue;
      const user = String(art.username).split('\n')[0].split('[')[0].trim();
      if (user && !map[user]) map[user] = art.avatar;
    }
  }
  return map;
}

function avatarFor(author, avatars) {
  if (avatars[author]) return avatars[author];

  const key = normUser(author);
  for (const name of Object.keys(avatars)) {
    if (normUser(name) === key) return avatars[name];
  }
  // Avatar por defecto de Discord (si no se conoce la foto real).
  return 'https://cdn.discordapp.com/embed/avatars/' + (hash(author) % 6) + '.png';
}

/* ---------------------------------------------------------------------------
 *  MAIN
 * ------------------------------------------------------------------------- */
function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const avatars = Object.assign({}, buildShowcaseAvatars(), buildScrapedAvatars());
  const messages = [];

  for (const event of EVENTS) {
    console.log('\n\u25b8 ' + event.title + '  (' + event.id + ')');

    const raw = [];
    for (const file of event.files) {
      const rawPath = ensureRaw(file);
      if (!rawPath) {
        console.warn('  \u26a0 falta raw/' + file);
        continue;
      }

      let part;
      try {
        part = readJson(rawPath);
      } catch (err) {
        console.warn('  \u26a0 no se pudo leer ' + file + ': ' + err.message);
        continue;
      }

      if (!Array.isArray(part)) {
        console.warn('  \u26a0 ' + file + ' no es un arreglo JSON, omitido');
        continue;
      }

      raw.push(...part);
      console.log('  \u2713 ' + file + '  (' + part.length + ' filas)');
    }

    for (const row of raw) {
      const msg = normalizeMessage(row);
      if (msg.kind === 'mine') continue;        // fuera mis propios mensajes
      if (!msg.id && !msg.content) continue;    // filas vacías
      messages.push(msg);
    }
  }

  const deduped = dedupById(messages)
    .sort((a, b) => (Date.parse(a.iso) || 0) - (Date.parse(b.iso) || 0));

  for (const msg of deduped) {
    msg.avatar = avatarFor(msg.author, avatars);
  }

  const featuredRaw = EVENTS.map((e) => e.featured).find(Boolean) || null;
  const featured = featuredRaw
    ? Object.assign({}, featuredRaw, { avatar: avatarFor(featuredRaw.author, avatars) })
    : null;

  const output = {
    generatedAt: new Date().toISOString(),
    channel: EVENTS[0].channel,
    me: EVENTS[0].me,
    count: deduped.length,
    featured,
    messages: deduped,
  };

  const outFile = path.join(DATA_DIR, 'menciones.json');
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');

  console.log('\n\u2713 data/menciones.json \u2192 ' + deduped.length + ' mensajes (sin los tuyos)');
  console.log('  \u00b7 ' + Object.keys(avatars).length + ' fotos de perfil conocidas');
}

main();
