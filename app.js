/* ==========================================================================
   Mini Evento Menciones — lógica del cliente (solo el chat)
   ========================================================================== */
(function () {
  'use strict';

  var GROUP_WINDOW_MS = 7 * 60 * 1000;

  var DATA = null;  // { channel, me, messages: [...] }
  var els = {};

  /* ======================================================================
     Utilidades
     ====================================================================== */
  function normUser(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function isMe(author) {
    return DATA && normUser(author) === normUser(DATA.me);
  }

  /* Sólo se "ilumina" si es una respuesta hacia mí (o mención nativa futura). */
  function mentionsMe(msg) {
    if (msg.kind === 'reply') return true;
    if (msg.replyTo && normUser(msg.replyTo) === normUser(DATA.me)) return true;
    return false;
  }

  function formatDay(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return 'Sin fecha';
    var s = d.toLocaleDateString('es', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatTime(msg) {
    var t = String(msg.time || '').trim();
    if (/^\d{1,2}:\d{2}(\s*[ap]\.?\s*m\.?)?$/i.test(t)) return t;
    if (msg.iso) {
      var d = new Date(msg.iso);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      }
    }
    return t;
  }

  /* ======================================================================
     DOM
     ====================================================================== */
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function avatarImg(msg) {
    var img = document.createElement('img');
    img.className = 'avatar';
    img.src = msg.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
    img.alt = '';
    img.loading = 'lazy';
    return img;
  }

  /* Texto normal. Sólo se estilizan menciones NATIVAS de Discord
     (<@id>, <@!id>, <@&rol>, <#canal>) si algún export las trae. */
  function contentNodes(text) {
    var frag = document.createDocumentFragment();

    if (!text) {
      frag.appendChild(el('span', 'attachment', '📎 Adjunto (imagen o archivo)'));
      return frag;
    }

    var re = /<@!?(\d+)>|<@&(\d+)>|<#(\d+)>/g;
    var last = 0;
    var m;

    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      }

      var label = m[1] ? '@usuario' : (m[2] ? '@rol' : '#canal');
      var pill = el('span', 'mention', label);
      pill.title = m[0];
      frag.appendChild(pill);

      last = m.index + m[0].length;
    }

    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    return frag;
  }

  /* ======================================================================
     Render
     ====================================================================== */
  function messageNode(msg, grouped, highlight) {
    var row = el('div', 'msg' + (grouped ? ' grouped' : ''));
    if (highlight) row.classList.add('is-mention');

    row.appendChild(avatarImg(msg));

    if (msg.replyTo) {
      var reply = el('div', 'reply');
      reply.appendChild(el('span', 'reply-line'));
      reply.appendChild(el('span', null, 'Respondiendo a ' + msg.replyTo));
      row.appendChild(reply);
    }

    if (!grouped) {
      var head = el('div', 'msg-head');
      head.appendChild(el('span', 'msg-author', msg.author));
      head.appendChild(el('span', 'msg-time', formatTime(msg)));
      row.appendChild(head);
    }

    var body = el('div', 'msg-body');
    body.appendChild(contentNodes(msg.content));
    row.appendChild(body);

    return row;
  }

  /* ======================================================================
     Mensaje fijo en la columna derecha
     ====================================================================== */
  function renderFeatured(feature) {
    if (!els.featured) return;
    els.featured.innerHTML = '';

    if (!feature) {
      els.featured.appendChild(el('div', 'featured-empty', 'Sin mensaje destacado.'));
      return;
    }

    var card = el('article', 'featured-card');

    var head = el('div', 'featured-head');
    var img = document.createElement('img');
    img.className = 'avatar';
    img.src = feature.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
    img.alt = '';
    head.appendChild(img);
    head.appendChild(el('span', 'msg-author', feature.author || 'Desconocido'));
    head.appendChild(el('span', 'msg-time', feature.time || ''));
    card.appendChild(head);

    var body = el('div', 'msg-body');
    body.appendChild(contentNodes(feature.content || ''));
    card.appendChild(body);

    if (feature.image) {
      var pic = document.createElement('img');
      pic.className = 'featured-image';
      pic.src = feature.image;
      pic.alt = feature.content || 'imagen';
      card.appendChild(pic);
    }

    if (feature.reactions && feature.reactions.length) {
      var wrap = el('div', 'reactions');
      feature.reactions.forEach(function (r) {
        var chip = el('span', 'reaction' + (r.me ? ' me' : ''));
        chip.appendChild(el('span', 'emoji', r.emoji || ''));
        chip.appendChild(el('span', 'count', String(r.count != null ? r.count : 1)));
        wrap.appendChild(chip);
      });
      card.appendChild(wrap);
    }

    els.featured.appendChild(card);
  }

  function render() {
    els.channelName.textContent = DATA.channel || 'mini-event';
    renderFeatured(DATA.featured);

    // Por si acaso: nunca mostrar mis propios mensajes.
    var list = DATA.messages.filter(function (m) { return !isMe(m.author); });

    if (list.length === 0) {
      els.messages.innerHTML = '';
      var empty = el('div', 'empty');
      empty.innerHTML = '<h3>Nada por aquí</h3><p>No hay menciones para mostrar.</p>';
      els.messages.appendChild(empty);
      return;
    }

    var frag = document.createDocumentFragment();
    var lastDay = null;
    var prev = null;

    list.forEach(function (msg) {
      var day = formatDay(msg.iso);
      if (day !== lastDay) {
        frag.appendChild(el('div', 'divider-day', day));
        lastDay = day;
        prev = null;
      }

      var grouped = false;
      if (prev && prev.author === msg.author) {
        var dt = (Date.parse(msg.iso) || 0) - (Date.parse(prev.iso) || 0);
        if (dt >= 0 && dt < GROUP_WINDOW_MS) grouped = true;
      }

      frag.appendChild(messageNode(msg, grouped, mentionsMe(msg)));
      prev = msg;
    });

    els.messages.innerHTML = '';
    els.messages.appendChild(frag);
    els.messages.scrollTop = 0;
  }

  /* ======================================================================
     Arranque
     ====================================================================== */
  function boot() {
    els.channelName = document.getElementById('channel-name');
    els.messages = document.getElementById('messages');
    els.featured = document.getElementById('featured');

    fetch('data/menciones.json')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        DATA = data;
        render();
      })
      .catch(function (err) {
        els.messages.innerHTML =
          '<div class="empty"><h3>Sin datos</h3>' +
          '<p>No se pudo cargar <code>data/menciones.json</code> (' + err.message + ').</p>' +
          '<p>Ejecuta <code>npm run import</code> y luego <code>npm run dev</code>.</p></div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
