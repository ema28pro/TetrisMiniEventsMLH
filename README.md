# 💬 Mini Eventos TETR.IO — Archivo de Menciones

Chat con **estilo Discord** que muestra **únicamente los mensajes donde me
mencionaron** durante los mini eventos de **TETR.IO** de Major League Hacking.

> Sin mis propios mensajes. La única excepción: si alguien **responde a un
> mensaje mío**, esa respuesta sí aparece.
>
> Es solo la parte del chat: sin riel de servidores, sin lista de canales, sin
> barra de conectados y sin compositor.

---

## ✨ Qué hace

- Réplica del **área de chat** de Discord (tema oscuro): foto de perfil, nombre,
  hora, agrupación de mensajes seguidos y divisor de día.
- La cabecera muestra el nombre del canal (`# menciones`). No hay nada más.
- **Fotos de perfil reales** de cada autor cuando se conocen (las guarda el
  scraper en `autor_avatar`; se completan con las del museo MLH). Si de alguien
  no hay foto, se usa el avatar por defecto de Discord.
- **No se resalta tu nombre** en el texto. Solo se ilumina un mensaje si es una
  **mención nativa de Discord** (`<@id>`) o una **respuesta hacia ti**.
- Todo sale de **un único JSON**: `data/menciones.json`.

---

## 🚀 Uso

```bash
npm run dev
#   ➜  http://localhost:3000/
```

Si cambias algo en `raw/` (nuevos exports), regenera el JSON:

```bash
npm run import
```

---

## ➕ Añadir un mini evento nuevo

1. **Scrapea tus menciones.** Abre Discord en el navegador, entra al canal del
   evento y pega el contenido de `discord_mentions_scraper.js` en la consola
   (F12 → Consola). Se descargará un `.json`.
   - `MODE = "mentions"` guarda solo lo que te menciona / tú escribes.
   - El campo `autor_avatar` guarda la **foto real** de cada autor.
2. **Copia el `.json`** dentro de `raw/`.
3. **Regístralo** en `scripts/import-event.js` → array `EVENTS`: añade el evento
   con su `id`, `title`, `date`, `me` y sus `files`.
4. **Regenera el JSON**:

   ```bash
   npm run import
   ```

5. Recarga `http://localhost:3000/`.

---

## 📁 Estructura

```
MiniEventoMenciones/
├── index.html                  markup del chat
├── style.css                   tema oscuro estilo Discord
├── app.js                      lee data/menciones.json y lo pinta
├── dev-server.js               servidor estático  →  npm run dev
├── discord_mentions_scraper.js scraper de consola para Discord
├── scripts/import-event.js     junta los exports en data/menciones.json
├── data/menciones.json         ⬅ EL JSON (generado)
├── raw/                        exports crudos de Discord
├── favicon.svg
└── vercel.json
```

### Modelo de `data/menciones.json`

```jsonc
{
  "generatedAt": "2026-10-13T…",
  "channel": "mini-event",
  "me": "!El_Ema",
  "count": 22,
  "featured": {
    "author": "pasta",
    "avatar": "https://cdn.discordapp.com/avatars/…/….webp?size=64",
    "time": "12:51",
    "iso": "2026-10-13T17:51:42.741Z",
    "content": "art",
    "image": "assets/pasta-art.webp",
    "reactions": [
      { "emoji": "😲", "count": 2 },
      { "emoji": "♥️", "count": 2, "me": true }
    ]
  },
  "messages": [
    {
      "id": "1559617172072829032",
      "author": "FAB",
      "avatar": "https://cdn.discordapp.com/avatars/…/….webp?size=64",
      "replyTo": null,
      "time": "12:04 p. m.",
      "iso": "2026-10-13T19:04:00.000Z",
      "content": "htf is emaunelle playing",
      "kind": "mention" // "mention" | "reply"
    }
  ]
}
```

`kind: "reply"` (alguien respondió a un mensaje mío) es lo único que se ilumina
de forma destacada, además de las menciones nativas de Discord.

El bloque **`featured`** es el mensaje que se muestra fijo en la **columna
derecha** (el chat con scroll queda a la izquierda). Se configura en
`scripts/import-event.js` → `EVENTS[].featured`. Las imágenes locales van en
`assets/`.

---

Desplegable como sitio estático (el `data/menciones.json` se sirve tal cual).
`vercel.json` incluido para Vercel.
