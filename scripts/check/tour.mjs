// Vérifie que la visite guidée ne saute pas : une seule position de carte par étape.
// Usage : serveur lancé (PORT=4332), puis « node scripts/check/tour.mjs ».
import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [w, h] of [
  [1440, 900],
  [1280, 800],
  [1024, 768],
]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => console.log('err', e.message));
  await p.goto(process.env.DS_URL ?? 'http://127.0.0.1:4332/');
  await p.waitForTimeout(400);
  const report = [];
  for (let i = 1; i <= 7; i++) {
    // Échantillonne la carte à chaque image pendant la transition.
    const samples = await p.evaluate(
      () =>
        new Promise((res) => {
          const out = [];
          const t0 = performance.now();
          const tick = () => {
            const c = document.querySelector('.tour-card');
            if (c) {
              const r = c.getBoundingClientRect();
              out.push([
                Math.round(performance.now() - t0),
                +getComputedStyle(c).opacity,
                Math.round(r.left),
                Math.round(r.top),
                Math.round(r.right),
                Math.round(r.bottom),
              ]);
            }
            if (performance.now() - t0 < 900) requestAnimationFrame(tick);
            else res(out);
          };
          tick();
        }),
    );
    const visible = samples.filter((s) => s[1] > 0.05);
    const pos = new Set(visible.map((s) => s.slice(2).join(',')));
    const last = samples.at(-1);
    const off =
      last &&
      (last[2] < 0 || last[3] < 0 || last[4] > innerWidthOf(w) || last[5] > h);
    report.push(
      `${i}:${pos.size}${off ? ' HORS ÉCRAN' : ''}${last && last[1] < 1 ? ' invisible' : ''}`,
    );
    if (i < 6)
      await p.getByRole('button', { name: 'Suivant', exact: true }).click();
  }
  console.log(w, report.join(' | '));
  await p.close();
}
function innerWidthOf(w) {
  return w;
}
await b.close();
