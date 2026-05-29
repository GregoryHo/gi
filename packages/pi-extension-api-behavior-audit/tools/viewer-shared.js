// Spliced into both viewer-template.html and review-template.html by render.py
// at the /*__SHARED_HELPERS__*/ marker. Keep this side-effect-free; it must run
// before the per-viewer "boot" code that depends on these helpers.

// ─── DOM micro-helpers ──────────────────────────────────────────────────────
function el(tag, props, children) {
  const node = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v === false || v == null) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style') Object.assign(node.style, v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
  }
  if (children) {
    const arr = Array.isArray(children) ? children : [children];
    for (const c of arr) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
  }
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// ─── URL + time formatters ──────────────────────────────────────────────────
function parseUrl(u) {
  try { return new URL(u); }
  catch { return null; }
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

function fmtDuration(ms) {
  if (ms == null || isNaN(ms)) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function statusClass(s) {
  if (s == null) return '';
  return String(Math.floor(s / 100));
}

function extractPath(ex) {
  const u = parseUrl(ex?.request?.url || '');
  if (u) return u.pathname;
  const m = (ex?.request?.url || '').match(/^[a-z]+:\/\/[^/]+(\/[^?#\s]*)/i);
  return m ? m[1] : (ex?.request?.url || '');
}

// ─── hash routing ───────────────────────────────────────────────────────────
function parseHash() {
  const h = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const out = {};
  if (!h) return out;
  for (const part of h.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = eq < 0 ? part : part.slice(0, eq);
    const v = eq < 0 ? '' : part.slice(eq + 1);
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function setHash(state) {
  const parts = Object.entries(state)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  const next = parts.join('&');
  if (next === (location.hash.startsWith('#') ? location.hash.slice(1) : '')) return;
  history.replaceState(null, '', next ? `#${next}` : location.pathname + location.search);
}

function onHashChange(fn) {
  window.addEventListener('hashchange', () => fn(parseHash()));
}

// ─── classification chip styling ────────────────────────────────────────────
const CLASSIFICATION_TONE = {
  'matches-known-upstream-candidate': 'gold',
  'matches-known-browser-api': 'blue',
  'high-frequency-background-candidate': 'dim-red',
};

const KIND_BADGE = {
  'in-allowlist': { glyph: '✓', tone: 'green',   label: 'in allowlist' },
  'background':   { glyph: '⊘', tone: 'dim-red', label: 'background' },
  'third-party':  { glyph: '🛇', tone: 'dim',     label: 'third-party' },
  'unlisted':     { glyph: '◯', tone: 'muted',   label: 'unlisted' },
};

function classificationChip(hints) {
  const list = Array.isArray(hints) ? hints : [];
  if (!list.length) return null;
  const first = list[0];
  const tone = CLASSIFICATION_TONE[first] || 'muted';
  return el('span', { class: `chip-classification tone-${tone}`, title: list.join(', '), text: first });
}

function kindBadge(kind) {
  const spec = KIND_BADGE[kind] || KIND_BADGE['unlisted'];
  return el('span', {
    class: `chip-kind tone-${spec.tone}`,
    title: spec.label,
    text: `${spec.glyph} ${kind}`,
  });
}
