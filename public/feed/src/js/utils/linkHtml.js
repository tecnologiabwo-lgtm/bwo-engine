import { linkify, safeHref, displayUrl } from './linkify.js';
import { esc } from './format.js';
/** Texto → HTML escapado con enlaces clicables. */
export const linkHtml = (text) => linkify(text).map((p) => p.type === 'link'
  ? `<a href="${esc(p.href)}" target="_blank" rel="noopener noreferrer nofollow" class="lnk">${esc(p.text)}</a>`
  : esc(p.text).replace(/\n/g, '<br>')).join('');
export const linkOne = (url) => { const h = safeHref(url); return h ? `<a href="${esc(h)}" target="_blank" rel="noopener noreferrer nofollow" class="lnk">${esc(displayUrl(h))}</a>` : esc(url); };
