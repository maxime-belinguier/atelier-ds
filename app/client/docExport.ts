import { tokenCss, type TokenKey, type Tokens } from '../shared/model.js';
import { auditTokens, score } from './a11yAudit.js';
import { cssName } from './exporters.js';
import { tokenGroups, tokenLabels } from './tokenMeta.js';

// Documentation du Design System en une page HTML autonome, imprimable en
// PDF depuis le navigateur. Toujours générée depuis les valeurs enregistrées.

export interface DocComponent {
  label: string;
  description: string;
  tokens: TokenKey[];
  html: string;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const val = (tokens: Tokens, k: TokenKey) => String(tokens[k].$value);
const unit = (tokens: Tokens, k: TokenKey) =>
  tokens[k].$type === 'dimension' ? `${val(tokens, k)} px` : val(tokens, k);
const code = (k: TokenKey) => `<code>--${cssName(k)}</code>`;

export function buildDocHtml({
  tokens,
  components,
  componentCss,
  project = 'Gutt',
  date = new Date(),
}: {
  tokens: Tokens;
  components: DocComponent[];
  componentCss: string;
  project?: string;
  date?: Date;
}) {
  const vars = Object.entries(tokenCss(tokens))
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
  const group = (id: string) => tokenGroups.find((g) => g.id === id)!.keys;

  const colors = group('colors')
    .map(
      (k) => `<figure class="swatch">
  <span style="background:${esc(val(tokens, k))}"></span>
  <figcaption><strong>${esc(tokenLabels[k])}</strong>${esc(val(tokens, k))}<br />${code(k)}</figcaption>
</figure>`,
    )
    .join('\n');

  const type = `<p class="meta">Police : <strong>${esc(val(tokens, 'font.family'))}</strong> ${code('font.family')}</p>
<div class="type-sample" style="font-family:var(--font-family)">
  <p style="font-size:var(--font-heading);font-weight:700;line-height:1.2;margin:0 0 8px">Ne signe pas à l’aveugle.</p>
  <p class="meta">Titre · ${unit(tokens, 'font.heading')} ${code('font.heading')}</p>
  <p style="font-size:var(--font-body);margin:16px 0 8px">Compare tes logements et vérifie l’essentiel avant de t’engager.</p>
  <p class="meta">Texte · ${unit(tokens, 'font.body')} ${code('font.body')}</p>
</div>`;

  const spaces = group('space')
    .map(
      (k) =>
        `<div class="space-row"><span class="bar" style="width:${Number(val(tokens, k))}px"></span><strong>${esc(tokenLabels[k])}</strong> ${unit(tokens, k)} ${code(k)}</div>`,
    )
    .join('\n');

  const shape = `<div class="space-row"><span class="radius" style="border-radius:var(--radius-control)"></span><strong>${esc(tokenLabels['radius.control'])}</strong> ${unit(tokens, 'radius.control')} ${code('radius.control')}</div>`;

  const comps = components
    .map(
      (c) => `<article class="comp">
  <h3>${esc(c.label)}</h3>
  <p class="meta">${esc(c.description)}</p>
  <div class="comp-stage">${c.html}</div>
  <p class="meta">Tokens : ${c.tokens.map(code).join(' ')}</p>
</article>`,
    )
    .join('\n');

  const checks = auditTokens(tokens);
  const status = { ok: 'OK', fail: 'À corriger', tip: 'Conseil' } as const;
  const rows = checks
    .map(
      (c) =>
        `<tr class="is-${c.status}"><td>${esc(c.group)}</td><td>${esc(c.label)}</td><td>${esc(c.value)}</td><td>${esc(c.rule)}</td><td><span class="pill">${status[c.status]}</span></td></tr>`,
    )
    .join('\n');
  const pct = score(checks);
  const day = date.toLocaleDateString('fr-FR');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(project)} · Design System</title>
<style>
:root { ${vars} }
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #1d1b2b; background: #fff; }
main { max-width: 980px; margin: 0 auto; padding: 48px 32px 80px; }
header.doc { padding-bottom: 8px; }
header.doc h1 { font-size: 40px; margin: 0; letter-spacing: -0.5px; }
header.doc p { margin: 6px 0 0; color: #5b5870; }
nav.toc { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 16px 0 0; font-size: 13px; }
nav.toc a { color: #1d1b2b; }
section.doc { margin-top: 48px; break-inside: avoid-page; }
section.doc > h2 { font-size: 24px; margin: 0 0 16px; padding-top: 8px; border-top: 1px solid #e4e2ee; }
.meta { color: #5b5870; font-size: 13px; margin: 4px 0; }
code { white-space: nowrap; font: 12px ui-monospace, Menlo, monospace; background: #f3f2f8; padding: 1px 5px; border-radius: 4px; color: #3b3850; }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; }
.swatch { margin: 0; border: 1px solid #e4e2ee; border-radius: 12px; overflow: hidden; break-inside: avoid; }
.swatch span { display: block; height: 72px; border-bottom: 1px solid #e4e2ee; }
.swatch figcaption { padding: 10px 12px; font-size: 13px; line-height: 1.6; }
.swatch strong { display: block; }
.type-sample { border: 1px solid #e4e2ee; border-radius: 12px; padding: 20px; margin-top: 12px; color: var(--color-text); }
.space-row { display: flex; align-items: center; gap: 12px; margin: 10px 0; font-size: 14px; }
.bar { height: 16px; min-width: 2px; background: var(--color-brand); border-radius: 3px; }
.radius { width: 56px; height: 40px; border: 2px solid var(--color-brand); background: #f3f2f8; }
.comp { border: 1px solid #e4e2ee; border-radius: 12px; padding: 18px; margin-bottom: 18px; break-inside: avoid; }
.comp h3 { margin: 0; font-size: 18px; }
.comp-stage { margin: 14px 0; padding: 20px; border-radius: 10px; background: var(--color-canvas); }
.comp-stage > .ds { background: transparent; max-width: 460px; }
.score { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.score strong { font-size: 36px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e4e2ee; vertical-align: top; }
th { color: #5b5870; font-weight: 600; }
.pill { font-size: 11px; font-weight: 650; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.is-ok .pill { background: #e3f4ea; color: #1f6b44; }
.is-fail .pill { background: #fde7e4; color: #a1251a; }
.is-tip .pill { background: #fdf1d8; color: #7a4b00; }
footer.doc { margin-top: 56px; color: #5b5870; font-size: 12px; }
@media print {
  main { padding: 0; }
  nav.toc { display: none; }
  section.doc { break-before: page; }
  section.doc:first-of-type { break-before: auto; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
/* Styles des composants, identiques à l'atelier */
${componentCss}
</style>
</head>
<body>
<main>
<header class="doc">
  <h1>${esc(project)} · Design System</h1>
  <p>Généré par DS-Studio le ${day}. Valeurs enregistrées. Pour un PDF : Fichier, Imprimer, Enregistrer en PDF.</p>
  <nav class="toc" aria-label="Sommaire">
    <a href="#couleurs">Couleurs</a><a href="#typo">Typographie</a><a href="#espacements">Espacements et formes</a><a href="#composants">Composants</a><a href="#accessibilite">Accessibilité</a>
  </nav>
</header>
<section class="doc" id="couleurs"><h2>Couleurs</h2><div class="swatches">
${colors}
</div></section>
<section class="doc" id="typo"><h2>Typographie</h2>
${type}
</section>
<section class="doc" id="espacements"><h2>Espacements et formes</h2>
${spaces}
${shape}
</section>
<section class="doc" id="composants"><h2>Composants</h2>
${comps}
</section>
<section class="doc" id="accessibilite"><h2>Accessibilité</h2>
<div class="score"><strong>${pct} %</strong><span class="meta">des critères WCAG 2.2 AA vérifiables sur les tokens. Les zones cliquables se mesurent dans l’atelier, sur chaque écran.</span></div>
<table>
<thead><tr><th>Domaine</th><th>Critère</th><th>Valeur</th><th>Règle</th><th>Statut</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</section>
<footer class="doc">Source : tokens DS-Studio, format DTCG simplifié. Variables CSS identiques à l’export « Variables CSS ».</footer>
</main>
</body>
</html>
`;
}
