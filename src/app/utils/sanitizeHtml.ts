/**
 * Allow-list HTML sanitizer for instructor-authored announcement bodies.
 *
 * Announcements are rich text rendered with dangerouslySetInnerHTML, which makes this the
 * XSS boundary for the feature. There is no DOMPurify in this project and the brief forbids
 * adding a dependency, so this is a deliberately conservative hand-rolled sanitizer:
 * anything not explicitly permitted is removed.
 *
 * Design notes:
 * - Parsing happens in a detached document via DOMParser. Nodes in a document produced by
 *   parseFromString are inert: <img onerror> does not fire, <script> does not execute, and
 *   no network request is made, because the document is never attached to a browsing context.
 * - The walk is bottom-up over a materialised node list, so unwrapping a node cannot cause
 *   the traversal to skip its siblings.
 * - Disallowed *formatting* elements are unwrapped (their text is preserved). Disallowed
 *   *dangerous* elements are dropped whole, content included — keeping the text of a
 *   <script> would paste executable source into the page as visible text.
 * - Sanitize on the way in AND again at render. Stored HTML predates any later tightening of
 *   this list, and a database row is not a trust boundary.
 */

/** Elements whose tag survives. Everything else is unwrapped or dropped. */
const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'A', 'P', 'BR', 'UL', 'OL', 'LI',
  'DIV', 'SPAN', 'H3', 'H4', 'BLOCKQUOTE', 'CODE', 'PRE',
]);

/** Elements dropped together with their subtree. */
const DROP_WITH_CONTENT: ReadonlySet<string> = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON',
  'TEXTAREA', 'SELECT', 'OPTION', 'LINK', 'META', 'BASE', 'TEMPLATE', 'NOSCRIPT',
  'SVG', 'MATH', 'AUDIO', 'VIDEO', 'SOURCE', 'TRACK', 'CANVAS', 'FRAME', 'FRAMESET',
]);

/** Attributes kept, per tag. Everything else — including every on* handler — is stripped. */
const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  A: new Set(['href', 'title']),
};

const SAFE_URL_SCHEMES = ['http:', 'https:', 'mailto:'];

const DEFAULT_MAX_LENGTH = 20000;

/**
 * True when an href is safe to keep. Rejects javascript:, data:, vbscript: and anything else
 * not explicitly allowed. Relative URLs are permitted and resolved against a dummy base.
 */
function isSafeHref(raw: string): boolean {
  // Strip control characters and whitespace first: "java\tscript:alert(1)" and
  // "java&#0;script:" are classic filter bypasses, and the URL parser tolerates them.
  const cleaned = raw.replace(/[\u0000-\u001F\u007F-\u009F\s]+/g, '');
  if (!cleaned) return false;
  try {
    // A relative URL resolves against the base and inherits its https: scheme.
    const parsed = new URL(cleaned, 'https://placeholder.invalid/');
    return SAFE_URL_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/** Replace a node with its own children, preserving the text the author typed. */
function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/**
 * Sanitize untrusted HTML down to the allow-list above.
 *
 * @param dirty     the HTML to clean; non-strings and empty input return ''
 * @param maxLength cap on the *serialized output* length (default 20000)
 */
export function sanitizeRichText(dirty: string, maxLength: number = DEFAULT_MAX_LENGTH): string {
  if (typeof dirty !== 'string' || dirty.trim() === '') return '';

  // Server-side / non-DOM contexts (tests, SSR) have no DOMParser. Fail closed by escaping
  // everything rather than returning markup that was never inspected.
  if (typeof DOMParser === 'undefined') {
    return escapeHtml(dirty).slice(0, maxLength);
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(`<body>${dirty}</body>`, 'text/html');
  } catch {
    return escapeHtml(dirty).slice(0, maxLength);
  }

  const body = doc.body;
  if (!body) return '';

  // Materialise the list before mutating: a live collection would shift under us.
  const elements = Array.from(body.querySelectorAll('*'));

  // Bottom-up, so unwrapping a parent cannot skip children we have not yet visited.
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    const tag = el.tagName.toUpperCase();

    if (DROP_WITH_CONTENT.has(tag)) {
      el.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      unwrap(el);
      continue;
    }

    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
    // Copy the attribute names first — removing while iterating a live NamedNodeMap skips entries.
    for (const attrName of Array.from(el.attributes).map((a) => a.name)) {
      const lower = attrName.toLowerCase();
      if (!allowed.has(lower)) {
        el.removeAttribute(attrName);
        continue;
      }
      if (lower === 'href' && !isSafeHref(el.getAttribute('href') || '')) {
        el.removeAttribute(attrName);
      }
    }

    // Surviving links always open safely. noopener/noreferrer blocks reverse-tabnabbing,
    // where the opened page can rewrite window.opener.location.
    if (tag === 'A' && el.hasAttribute('href')) {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  }

  const out = body.innerHTML;
  return out.length > maxLength ? out.slice(0, maxLength) : out;
}

/** Plain-text projection of (possibly dirty) HTML, for previews, list rows and empty checks. */
export function htmlToPlainText(html: string): string {
  if (typeof html !== 'string' || html === '') return '';
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    // Block-level boundaries should read as spaces, not run words together.
    doc.body.querySelectorAll('br, p, div, li, h3, h4, blockquote').forEach((el) => {
      el.appendChild(doc.createTextNode(' '));
    });
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/** True when the HTML carries no visible text and no meaningful embedded content. */
export function isBlankRichText(html: string): boolean {
  return htmlToPlainText(html).length === 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
