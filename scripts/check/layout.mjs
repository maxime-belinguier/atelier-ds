// Audit de mise en page : 8 largeurs, débordements, éléments coupés, hauteurs des contrôles.
// Usage : serveur lancé (PORT=4332), puis « node scripts/check/layout.mjs ». « 0 anomalie » = OK.
import { chromium } from 'playwright';
const URL = process.env.DS_URL ?? 'http://127.0.0.1:4332';
const OUT = process.env.DS_SHOTS ?? 'test-results/shots';
await import('node:fs').then((f) => f.mkdirSync(OUT, { recursive: true }));
const b = await chromium.launch();
const issues = [];
const heights = new Map();
async function audit(p, label) {
  const r = await p.evaluate(() => {
    const out = {
      page: document.documentElement.scrollWidth > innerWidth + 1,
      clipped: [],
      heights: {},
    };
    for (const e of document.querySelectorAll('body *')) {
      if (e.closest('.ds, iframe, .sr-only') || e.offsetParent === null)
        continue;
      const cs = getComputedStyle(e);
      if (
        ['hidden', 'clip'].includes(cs.overflowX) &&
        e.scrollWidth > e.clientWidth + 1 &&
        !e.matches('.ds-pane')
      )
        out.clipped.push(
          (e.className || e.tagName) +
            ' ' +
            e.scrollWidth +
            '>' +
            e.clientWidth,
        );
    }
    for (const pane of document.querySelectorAll(
      '.pane, .chat-panel, dialog[open]',
    )) {
      if (pane.offsetParent === null && !pane.matches('dialog[open]')) continue;
      const pr = pane.getBoundingClientRect();
      for (const e of pane.querySelectorAll(
        'button, input, select, textarea, .chat-message, .token-row, .segmented',
      )) {
        if (e.offsetParent === null || e.closest('.ds, .ds-sidebar')) continue;
        const r = e.getBoundingClientRect();
        if (r.width && (r.right > pr.right + 1 || r.left < pr.left - 1))
          out.clipped.push(
            'hors cadre: ' +
              (e.getAttribute('aria-label') ||
                e.textContent.trim().slice(0, 24) ||
                e.className),
          );
      }
    }
    for (const btn of document.querySelectorAll(
      '.header-actions button, .file-button, .save-status button, .icon-button, .segmented, .screen-picker, .dialog-actions button, .chat-form button',
    ))
      if (btn.offsetParent !== null)
        out.heights[btn.className || btn.textContent.trim()] = Math.round(
          btn.getBoundingClientRect().height,
        );
    return out;
  });
  if (r.page || r.clipped.length)
    issues.push({ label, page: r.page, clipped: [...new Set(r.clipped)] });
  for (const [k, v] of Object.entries(r.heights))
    heights.set(k, (heights.get(k) ?? new Set()).add(v));
}
for (const [w, h] of [
  [1920, 1080],
  [1440, 900],
  [1280, 800],
  [1100, 760],
  [1024, 768],
  [901, 800],
  [768, 1024],
  [375, 812],
]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.addInitScript(() => localStorage.setItem('ds-studio-tour-done', '1'));
  await p.goto(URL);
  await p.waitForTimeout(1200);
  await p.getByLabel('Couleur de marque', { exact: true }).fill('#1F4D3A');
  const splits = w > 900 ? ['Home', 'End'] : [null];
  for (const key of splits) {
    if (key) {
      await p.getByRole('separator').focus();
      await p.keyboard.press(key);
      await p.waitForTimeout(250);
    }
    for (const pick of [
      'Couleurs',
      'Espacements',
      'Fiche logement',
      'Formulaire',
    ]) {
      const btn = p
        .getByRole('button', { name: new RegExp('^' + pick) })
        .first();
      if (await btn.isVisible()) await btn.click();
      else
        await p
          .getByLabel('Section du Design System')
          .selectOption({ label: pick });
      await p.waitForTimeout(120);
      for (const d of ['Mobile compact 320 px', 'Grand écran 1440 px']) {
        await p.getByRole('button', { name: d, exact: true }).click();
        await p.waitForTimeout(80);
        await audit(p, `${w}px ${key ?? ''} ${pick} ${d}`);
      }
    }
  }
  // Chat : longs messages, mot sans espace, liste
  await p.route('**/api/agent', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message:
          'Voici une réponse très longue. '.repeat(25) +
          '\nhttps://example.com/' +
          'x'.repeat(160) +
          '\n- point 1\n- point 2',
        proposal: null,
      }),
    }),
  );
  await p.route('**/api/agents', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'claude',
          available: true,
          detail:
            'Claude Code 2.1 détecté · simulation de test, sans outils, aucun appel réel effectué ici.',
        },
      ]),
    }),
  );
  await p.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
  await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) {
    await p
      .getByLabel('Ta demande')
      .fill('Message ' + i + ' ' + 'motsanslesespacesmaistreslong'.repeat(6));
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
  }
  await audit(p, `${w}px chat`);
  if (w === 1440 || w === 375)
    await p.screenshot({ path: `${OUT}/audit-chat-${w}.png` });
  await p.close();
}
// Historique long + diff avec beaucoup de lignes
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.addInitScript(() => localStorage.setItem('ds-studio-tour-done', '1'));
await p.goto(URL);
await p.waitForTimeout(1200);
for (const [k, v] of [
  ['Couleur de marque', '#224466'],
  ['Texte principal', '#111827'],
  ['Bordures', '#CCCCCC'],
  ['Couleur d’alerte', '#B91C1C'],
  ['Couleur de réussite', '#15803D'],
  ['Contour du focus', '#2563EB'],
  ['Fond de page', '#F9FAFB'],
  ['Texte secondaire', '#4B5563'],
])
  await p.getByLabel(k, { exact: true }).fill(v);
await p.getByRole('button', { name: /^Enregistrer \(/ }).click();
await p.waitForTimeout(300);
await audit(p, 'diff 8 lignes');
await p.screenshot({ path: `${OUT}/audit-diff.png` });
await p.getByRole('button', { name: 'Valider et enregistrer' }).click();
await p.waitForTimeout(500);
await p.getByRole('button', { name: 'Historique' }).click();
await p.waitForTimeout(400);
await audit(p, 'historique');
await p.screenshot({ path: `${OUT}/audit-history.png` });
await b.close();
console.log(JSON.stringify(issues, null, 1));
console.log(
  'HAUTEURS',
  JSON.stringify(Object.fromEntries([...heights].map(([k, v]) => [k, [...v]]))),
);
