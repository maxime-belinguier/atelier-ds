import { test, expect, type Page } from '@playwright/test';

const state = async (page: Page) =>
  (await page.request.get('/api/state')).json();
const diff = (page: Page) =>
  page.getByRole('dialog', { name: 'Valider les changements' });

// La visite guidée s'ouvre au premier lancement : on la marque comme vue,
// sauf dans le test qui la vérifie.
test.beforeEach(async ({ page }, info) => {
  if (!info.title.startsWith('visite guidée'))
    await page.addInitScript(() =>
      localStorage.setItem('ds-studio-tour-done', '1'),
    );
});

test('boucle centrale : aperçu immédiat, diff, validation, recharge, retour en arrière ciblé', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Design System', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Figma', exact: true }),
  ).toBeVisible();
  const mobile = page.frameLocator('iframe');
  const keep = mobile.getByRole('button', {
    name: 'Garder ce logement',
    exact: true,
  });
  await expect(keep).toHaveCSS('background-color', 'rgb(49, 84, 196)');
  const brand = page.getByLabel('Couleur de marque', { exact: true });
  await brand.fill('#8A3B20');
  // Aperçu immédiat dans l'iframe, sans aucune écriture.
  await expect(keep).toHaveCSS('background-color', 'rgb(138, 59, 32)');
  expect((await state(page)).revision).toBe(0);
  await expect(page.getByText('1 modif non enregistrée')).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer (1)' }).click();
  await expect(diff(page)).toContainText('#3154C4');
  await expect(diff(page)).toContainText('#8A3B20');
  await diff(page).getByRole('button', { name: 'Ne pas appliquer' }).click();
  await expect(diff(page)).not.toBeVisible();
  // Refuser le diff ne perd pas la modification en cours.
  await expect(brand).toHaveValue('#8A3B20');
  expect((await state(page)).revision).toBe(0);
  await page.getByRole('button', { name: 'Enregistrer (1)' }).click();
  await diff(page)
    .getByRole('button', { name: 'Valider et enregistrer' })
    .click();
  await expect(diff(page)).not.toBeVisible();
  await expect(page.getByText('1 modif non enregistrée')).not.toBeVisible();
  await expect(page.getByText('Enregistré', { exact: true })).toBeVisible();
  expect((await state(page)).tokens['color.brand'].$value).toBe('#8A3B20');
  await page.getByRole('button', { name: 'Boutons' }).click();
  // Composant choisi : sa planche des états, dans la colonne de gauche.
  const main = page
    .locator('.component-stage')
    .getByRole('button', { name: 'Garder', exact: true })
    .first();
  await expect(main).toHaveCSS('background-color', 'rgb(138, 59, 32)');
  await page.reload();
  await expect(keep).toHaveCSS('background-color', 'rgb(138, 59, 32)');
  await page.getByRole('button', { name: /^Espacements/ }).click();
  await page.getByLabel('Espacement moyen', { exact: true }).fill('22');
  // Raccourci clavier d'enregistrement : ouvre le même diff.
  await page.keyboard.press('Control+s');
  await diff(page)
    .getByRole('button', { name: 'Valider et enregistrer' })
    .click();
  await expect(diff(page)).not.toBeVisible();
  await page.getByRole('button', { name: /Historique/ }).click();
  await page
    .getByRole('button', {
      name: 'Revenir en arrière sur le changement n°1',
      exact: true,
    })
    .click();
  await diff(page)
    .getByRole('button', { name: 'Valider et enregistrer' })
    .click();
  await expect(diff(page)).not.toBeVisible();
  await page.getByRole('button', { name: 'Boutons' }).click();
  await expect(main).toHaveCSS('background-color', 'rgb(49, 84, 196)');
  await expect(main).toHaveCSS('padding-left', '22px');
  await expect(keep).toHaveCSS('background-color', 'rgb(49, 84, 196)');
  await page.screenshot({ path: 'test-results/studio.png', fullPage: true });
});

test('largeurs réelles, ajustement visuel, interactions et formulaire', async ({
  page,
}) => {
  await page.goto('/');
  const frame = page.frameLocator('iframe');
  for (const [name, width] of [
    ['Mobile compact 320 px', 320],
    ['Mobile 375 px', 375],
    ['Grand mobile 430 px', 430],
    ['Tablette 768 px', 768],
    ['Ordinateur 1280 px', 1280],
  ] as const) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('iframe')).toHaveAttribute(
      'width',
      String(width),
    );
    await expect
      .poll(() =>
        page
          .locator('iframe')
          .evaluate((f: HTMLIFrameElement) => f.contentWindow?.innerWidth),
      )
      .toBe(width);
    expect(
      await frame
        .locator('body')
        .evaluate((el) => el.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const columns = await frame
      .locator('.scenario-grid')
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
      );
    expect(columns).toBe(width >= 700 ? 2 : 1);
  }
  // « Fit » réduit l'affichage sans changer la largeur CSS réelle.
  const holder = page.locator('.frame-holder');
  expect(await holder.evaluate((el) => el.clientWidth)).toBeLessThan(1280);
  const zoom = page.getByRole('group', { name: 'Zoom', exact: true });
  await zoom.getByRole('button', { name: /revenir à 100 %/ }).click();
  expect(await holder.evaluate((el) => el.clientWidth)).toBeGreaterThanOrEqual(
    1280,
  );
  // − / + : zoom libre par paliers, la largeur CSS ne change pas.
  await expect(zoom.locator('.zoom-value')).toHaveText('100 %');
  await zoom.getByRole('button', { name: 'Dézoomer' }).click();
  await expect(zoom.locator('.zoom-value')).toHaveText('75 %');
  expect(await holder.evaluate((el) => el.clientWidth)).toBeLessThan(1280);
  await expect(page.locator('iframe')).toHaveAttribute('width', '1280');
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page
    .getByRole('button', { name: 'Mobile 375 px', exact: true })
    .click();
  await frame
    .getByRole('button', { name: 'Garder ce logement', exact: true })
    .click();
  await expect(
    frame.getByRole('button', { name: 'Logement gardé ✓' }),
  ).toBeVisible();
  await frame.getByRole('button', { name: 'À vérifier', exact: true }).click();
  await expect(
    frame.getByText('Les points à vérifier avant de signer.'),
  ).toBeVisible();
  // Sélecteur d'écran : liste filtrable, puis suivant / précédent.
  await page.getByRole('button', { name: 'Écran affiché : Mes biens' }).click();
  await page.getByLabel('Rechercher un écran').fill('ajouter');
  await page.getByRole('option', { name: /Ajouter un logement/ }).click();
  await expect(
    page.getByRole('button', { name: 'Écran affiché : Ajouter un logement' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Écran précédent' }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', /scenario=cards/);
  await page.getByRole('button', { name: 'Écran suivant' }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', /scenario=form/);
  await frame.getByLabel('Adresse ou quartier').fill('Chartrons');
  await frame.getByLabel('Loyer charges comprises (€)').fill('720');
  await frame.getByLabel('Surface (m²)').fill('40');
  await frame.getByRole('checkbox').check();
  await frame
    .getByRole('button', { name: 'Analyser ce logement', exact: true })
    .click();
  await expect(frame.getByText(/18,0 €\/m²/)).toBeVisible();
  await page.setViewportSize({ width: 700, height: 900 });
  expect(
    await page
      .locator('body')
      .evaluate((el) => el.scrollWidth <= window.innerWidth),
  ).toBe(true);
});

test('valeur invalide signalée sur la ligne, sans diff ni écriture', async ({
  page,
}) => {
  await page.goto('/');
  const before = await state(page);
  const brand = page.getByLabel('Couleur de marque', { exact: true });
  await brand.fill('red');
  await expect(page.getByText('Couleur attendue : #RRGGBB')).toBeVisible();
  await expect(brand).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.getByRole('button', { name: /^Enregistrer \(/ }),
  ).toBeDisabled();
  await expect(diff(page)).not.toBeVisible();
  expect((await state(page)).revision).toBe(before.revision);
  await brand.fill('#123456');
  await page.getByRole('button', { name: 'Enregistrer (1)' }).click();
  await expect(
    page.getByRole('button', { name: 'Ne pas appliquer' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(diff(page)).not.toBeVisible();
});

test('export navigateur, import valide avec diff, fichier invalide sans écriture', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Couleurs' })).toBeVisible();
  const before = await state(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  await page.getByRole('menuitem', { name: /^Tokens JSON/ }).click();
  const file = await download;
  const { readFile } = await import('node:fs/promises');
  const exported = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(exported).toEqual(before.tokens);
  exported['color.success'].$value = '#125533';
  await page.locator('input[type=file]').setInputFiles({
    name: 'palette.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(diff(page)).toContainText('color.success');
  expect((await state(page)).revision).toBe(before.revision);
  await diff(page)
    .getByRole('button', { name: 'Valider et enregistrer' })
    .click();
  await expect(diff(page)).not.toBeVisible();
  const after = await state(page);
  expect(after.tokens['color.success'].$value).toBe('#125533');
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  expect((await state(page)).revision).toBe(after.revision);
});

test('aperçu et contraste immédiats, valeur enregistrée inchangée', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Couleur de marque', { exact: true }).fill('#FFFFFF');
  await expect(page.locator('#row-color-brand')).toContainText(
    'À corriger · Texte des boutons : 1,00:1',
  );
  await expect(
    page
      .frameLocator('iframe')
      .getByRole('button', { name: 'Garder ce logement', exact: true }),
  ).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(diff(page)).not.toBeVisible();
  expect((await state(page)).tokens['color.brand'].$value).not.toBe('#FFFFFF');
});

test('brief privé dans son panneau, persistant, sans compte IA', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Brief', exact: true }).click();
  const brief = page.getByRole('dialog', { name: 'Brief du projet' });
  // Le nom vient du projet, plus de champ en double.
  await expect(brief.getByText('Projet : Gutt (PFE)')).toBeVisible();
  await expect(brief.getByLabel('Nom du projet')).toHaveCount(0);
  await expect(brief.getByLabel(/Lien Figma/)).toHaveCount(0);
  await brief
    .getByLabel('Public concerné', { exact: true })
    .fill('Étudiants en mobilité');
  await brief
    .getByLabel('Objectif et critères de réussite', { exact: true })
    .fill('Réserver en moins de trois étapes');
  await brief.getByRole('button', { name: 'Enregistrer le brief' }).click();
  await expect(brief.getByText('Brief enregistré sur ce poste.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(brief).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Brief', exact: true }).click();
  await expect(
    brief.getByRole('textbox', { name: 'Public concerné' }),
  ).toHaveValue('Étudiants en mobilité');
});

test('recherche, modifications reprises après recharge et « Tout annuler » sans écriture', async ({
  page,
}) => {
  await page.goto('/');
  const before = await state(page);
  await page.getByLabel('Rechercher un token').fill('space');
  await expect(page.getByText('3 tokens pour « space ».')).toBeVisible();
  await page.getByLabel('Grand espacement', { exact: true }).fill('31');
  await expect(page.getByText('1 modif non enregistrée')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /^Espacements/ }).click();
  await expect(
    page.getByLabel('Grand espacement', { exact: true }),
  ).toHaveValue('31');
  await expect(page.getByText('1 modif non enregistrée')).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Annuler les modifications non enregistrées',
    })
    .click();
  await expect(
    page.getByLabel('Grand espacement', { exact: true }),
  ).toHaveValue(String(before.tokens['space.lg'].$value));
  expect((await state(page)).revision).toBe(before.revision);
});

test('conflit multi-onglets visible dans le diff, aucune perte de données', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByLabel('Couleur de marque', { exact: true }).fill('#223355');
  await page.getByRole('button', { name: 'Enregistrer (1)' }).click();
  const other = await context.newPage();
  await other.goto('/');
  await other.getByLabel('Couleur de marque', { exact: true }).fill('#664422');
  await other.getByRole('button', { name: 'Enregistrer (1)' }).click();
  await diff(other)
    .getByRole('button', { name: 'Valider et enregistrer' })
    .click();
  await expect(diff(other)).not.toBeVisible();
  await expect(diff(page).getByRole('alert')).toContainText(
    'Une autre validation',
  );
  await expect(
    diff(page).getByRole('button', { name: 'Valider et enregistrer' }),
  ).toBeDisabled();
  await diff(page).getByRole('button', { name: 'Ne pas appliquer' }).click();
  expect((await state(page)).tokens['color.brand'].$value).toBe('#664422');
  await other.close();
});

test('capacité de session périmée simulée sans rejeu ambigu', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Couleurs' }).waitFor();
  const boot = await (await page.request.get('/api/bootstrap')).json();
  // Un seul refus certain avant mutation, comme une capacité périmée après restart.
  let requests = 0;
  await page.route('**/api/proposals', async (route) => {
    requests++;
    if (requests === 1)
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Validation de session manquante. Recharge la page.',
        }),
      });
    expect(route.request().headers()['x-ds-studio']).toBe(boot.csrf);
    return route.continue();
  });
  await page.getByLabel('Contour du focus', { exact: true }).fill('#776622');
  await page.getByRole('button', { name: 'Enregistrer (1)' }).click();
  await expect(diff(page)).toBeVisible();
  expect(requests).toBe(2);
  await page.keyboard.press('Escape');
});

test('clavier, mobile 375 px et absence de stockage navigateur', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Stockage refusé');
    };
    Storage.prototype.getItem = () => {
      throw new DOMException('Stockage refusé');
    };
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('heading', { name: 'Couleurs' }).waitFor();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Aller aux tokens' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Design System', exact: true }),
  ).toBeFocused();
  await page.getByLabel('Couleur de marque', { exact: true }).fill('#114477');
  await page.getByRole('button', { name: 'Enregistrer (1)' }).click();
  await expect(diff(page)).toBeVisible();
  await page.keyboard.press('Escape');
  expect(
    await page.locator('body').evaluate((el) => el.scrollWidth <= innerWidth),
  ).toBe(true);
  // Panneau étroit : la navigation passe par une liste déroulante.
  await page
    .getByLabel('Section du Design System')
    .selectOption('component:logement');
  await expect(
    page.getByRole('heading', { name: 'Fiche logement', level: 3 }),
  ).toBeVisible();
});

test('historique : panneau latéral modal, fermeture Échap et fond', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Historique/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Historique' });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('Tu peux revenir en arrière');
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await page.getByRole('button', { name: /Historique/ }).click();
  await drawer.getByRole('button', { name: 'Fermer l’historique' }).click();
  await expect(drawer).not.toBeVisible();
  await page.getByRole('button', { name: /Historique/ }).click();
  await page.mouse.click(20, 400);
  await expect(drawer).not.toBeVisible();
});

test('panneaux redimensionnables au clavier, plein écran et assistant flottant', async ({
  page,
}) => {
  await page.goto('/');
  const separator = page.getByRole('separator', {
    name: 'Largeur du panneau Design System',
  });
  const pane = page.locator('.ds-pane');
  const before = Number(await separator.getAttribute('aria-valuenow'));
  const width = await pane.evaluate((el) => el.getBoundingClientRect().width);
  await separator.focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', String(before + 10));
  expect(
    await pane.evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(width);
  await page.keyboard.press('Home');
  await expect(separator).toHaveAttribute(
    'aria-valuenow',
    (await separator.getAttribute('aria-valuemin'))!,
  );
  // Le panneau Design System garde une largeur utilisable (440 px minimum).
  expect(
    await pane.evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThanOrEqual(439);
  await page.getByRole('button', { name: 'Plein écran' }).click();
  await expect(pane).toBeHidden();
  await page.getByRole('button', { name: 'Quitter le plein écran' }).click();
  await expect(pane).toBeVisible();
  await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
  const assistant = page.getByRole('complementary', { name: 'Assistant' });
  await expect(assistant).toBeVisible();
  await expect(page.getByLabel('Ta demande')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(assistant).toBeHidden();
});

test('assistant : modèle, effort, tokens et jauge des crédits', async ({
  page,
}) => {
  let sent: Record<string, unknown> = {};
  await page.route('**/api/agents', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'claude',
          available: true,
          detail: 'Claude simulé pour le test.',
        },
      ]),
    }),
  );
  await page.route('**/api/agent', async (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Réponse simulée.',
        proposal: null,
        usage: {
          model: 'claude-opus-5-5',
          inputTokens: 12345,
          outputTokens: 210,
        },
        limits: [
          { id: 'five_hour', utilization: 0.42, resetsAt: 1793106600 },
          { id: 'seven_day', utilization: 0.93, resetsAt: 1793386800 },
        ],
      }),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
  await page.getByLabel('Modèle').selectOption('opus');
  await page.getByLabel('Effort').selectOption('high');
  await page.getByLabel('Ta demande').fill('Bonjour');
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('Opus · effort élevé · 12 345 tokens envoyés · 210 générés'),
  ).toBeVisible();
  await expect(page.getByText('Conversation : 12 555 tokens')).toBeVisible();
  // Jauge des crédits : mini cercle, détail au clic.
  await expect(
    page.getByRole('button', {
      name: /^Crédits : Session \(5 h\) 42 %, Semaine 93 %/,
    }),
  ).toContainText('93');
  await page.getByRole('button', { name: /^Crédits/ }).click();
  await expect(
    page.getByRole('progressbar', { name: 'Session (5 h) : crédits utilisés' }),
  ).toHaveAttribute('aria-valuenow', '42');
  await expect(
    page.getByRole('progressbar', { name: 'Semaine : crédits utilisés' }),
  ).toHaveAttribute('aria-valuenow', '93');
  expect(sent.model).toBe('opus');
  expect(sent.effort).toBe('high');
  expect(sent.history).toEqual([]);
});

test('aperçu : mockups d’appareil par format, format libre saisi et étiré', async ({
  page,
}) => {
  await page.goto('/');
  const frame = page.locator('.device');
  const mockup = page.getByLabel('Mockup');
  await expect(frame).toHaveClass(/device-phone/);
  await page.getByRole('button', { name: 'Tablette 768 px' }).click();
  await expect(frame).toHaveClass(/device-tablet/);
  await page.getByRole('button', { name: 'Grand écran 1440 px' }).click();
  await expect(frame).toHaveClass(/device-browser/);
  await mockup.uncheck();
  await expect(frame).toHaveClass(/device-none/);
  await mockup.check();
  await expect(frame).toHaveClass(/device-browser/);
  // Format libre : saisie, cadre indisponible, puis étirement à la souris.
  await page.getByRole('button', { name: /^Format libre/ }).click();
  await expect(mockup).toBeDisabled();
  await page.getByLabel('Largeur en px').fill('700');
  await page.getByLabel('Hauteur en px').focus();
  await expect(page.locator('iframe')).toHaveAttribute('width', '700');
  await expect
    .poll(() =>
      page
        .locator('iframe')
        .evaluate((f: HTMLIFrameElement) => f.contentWindow?.innerWidth),
    )
    .toBe(700);
  await page.keyboard.press('Escape');
  const handle = page.locator('.handle-x');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 3, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x - 60, box.y + 20, { steps: 5 });
  await page.mouse.up();
  const width = Number(await page.locator('iframe').getAttribute('width'));
  expect(width).toBeLessThan(700);
  await expect(
    page.getByRole('button', { name: /^Format libre/ }),
  ).toContainText(`${width} ×`);
  // La taille libre est mémorisée en revenant d'un format prédéfini.
  await page.getByRole('button', { name: 'Mobile 375 px' }).click();
  await expect(frame).toHaveClass(/device-phone/);
  await page.getByRole('button', { name: /^Format libre/ }).click();
  await expect(page.locator('iframe')).toHaveAttribute('width', String(width));
});

test('sélecteur de couleur : HEX d’abord, zone, palette du DS, récentes', async ({
  page,
}) => {
  await page.goto('/');
  const before = await state(page);
  await page
    .getByRole('button', {
      name: 'Ouvrir le sélecteur de couleur : Couleur de marque',
    })
    .click();
  const hex = page.getByLabel('Code HEX : Couleur de marque');
  await expect(hex).toBeFocused();
  // Forme courte acceptée, aperçu immédiat, rien d'enregistré.
  await hex.fill('48e');
  await expect(
    page.getByLabel('Couleur de marque', { exact: true }),
  ).toHaveValue('#4488EE');
  await expect(
    page
      .frameLocator('iframe')
      .getByRole('button', { name: 'Garder ce logement', exact: true }),
  ).toHaveCSS('background-color', 'rgb(68, 136, 238)');
  // Zone saturation / luminosité au clavier.
  await page.getByRole('slider', { name: 'Saturation et luminosité' }).focus();
  await page.keyboard.press('Shift+ArrowDown');
  await expect(hex).not.toHaveValue('#4488EE');
  // Couleur du DS en un clic.
  await page
    .getByRole('button', {
      name: /^Utiliser #[0-9A-F]{6} \(Couleur d’alerte\)/,
    })
    .click();
  await expect(
    page.getByLabel('Couleur de marque', { exact: true }),
  ).toHaveValue(before.tokens['color.danger'].$value);
  // Formats d'affichage : HEX → RGB → HSL, la valeur reste en HEX.
  await page.getByRole('button', { name: /^Format HEX/ }).click();
  await page.getByLabel('Rouge').fill('255');
  await page.getByLabel('Vert').fill('0');
  await page.getByLabel('Bleu').fill('0');
  await page.getByLabel('Bleu').press('Enter');
  await expect(
    page.getByLabel('Couleur de marque', { exact: true }),
  ).toHaveValue('#FF0000');
  await page.getByRole('button', { name: /^Format RGB/ }).click();
  await expect(page.getByLabel('Teinte (degrés)')).toHaveValue('0');
  await expect(page.getByLabel('Saturation (%)')).toHaveValue('100');
  await page.getByRole('button', { name: /^Format HSL/ }).click();
  await expect(hex).toHaveValue('#FF0000');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /^Couleur :/ })).toHaveCount(0);
  expect((await state(page)).revision).toBe(before.revision);
  // La couleur choisie apparaît dans « Récentes » à la réouverture.
  await page
    .getByRole('button', {
      name: 'Ouvrir le sélecteur de couleur : Texte principal',
    })
    .click();
  await expect(page.getByText('Récentes')).toBeVisible();
});

test('en-tête en icônes : export CSS et Tailwind depuis le menu', async ({
  page,
}) => {
  await page.goto('/');
  const before = await state(page);
  const { readFile } = await import('node:fs/promises');
  for (const [item, file, needle] of [
    [
      /^Variables CSS/,
      'tokens.css',
      `--color-brand: ${before.tokens['color.brand'].$value};`,
    ],
    [/^Tailwind v4/, 'theme.css', '@theme {'],
    [/^Tailwind v3/, 'tailwind.config.js', '"extend"'],
  ] as const) {
    await page.getByRole('button', { name: 'Exporter', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: item }).click();
    const d = await download;
    expect(d.suggestedFilename()).toBe(file);
    expect(await readFile((await d.path())!, 'utf8')).toContain(needle);
  }
  // Le menu se ferme avec Échap.
  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  await expect(page.getByRole('menu', { name: 'Exporter' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Exporter' })).toHaveCount(0);
});

test('export Documentation : page HTML complète et autonome', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: /^Documentation/ }).click();
  const d = await download;
  expect(d.suggestedFilename()).toBe('gutt-design-system.html');
  const { readFile } = await import('node:fs/promises');
  const html = await readFile((await d.path())!, 'utf8');
  for (const needle of [
    '<h2>Couleurs</h2>',
    '<h2>Composants</h2>',
    '<h2>Accessibilité</h2>',
    'class="ds-button primary"',
    '.ds-button {',
  ])
    expect(html).toContain(needle);
  expect(html).not.toMatch(/<script/);
});

test('menu : catégories repliables, mémorisées, page ouverte signalée', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const nav = page.getByRole('navigation', {
    name: 'Contenu du Design System',
  });
  const head = nav.getByRole('button', { name: /^Composants/ });
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect(nav.getByRole('button', { name: 'Boutons' })).toHaveCount(0);
  // Repliée, la catégorie masque tout, même la page ouverte ; son titre est
  // alors mis en avant.
  const tokens = nav.getByRole('button', { name: /^Tokens/ });
  await tokens.click();
  await expect(nav.getByRole('button', { name: /^Couleurs/ })).toHaveCount(0);
  await expect(tokens).toHaveClass(/has-current/);
  await expect(
    nav.getByRole('button', { name: /^Composants/ }),
  ).not.toHaveClass(/has-current/);
  await page.reload();
  await expect(
    nav.getByRole('button', { name: /^Composants/ }),
  ).toHaveAttribute('aria-expanded', 'false');
  // La recherche garde sa hauteur.
  expect(
    await page
      .locator('.sidebar-search')
      .evaluate((e) => e.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(34);
});

test('contrôle d’accessibilité : bilan par profil, sans édition', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /^Accessibilité/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Contrôle d’accessibilité' }),
  ).toBeVisible();
  await expect(page.locator('.report-card')).toHaveCount(6);
  // Ici on contrôle : aucun champ de token, aucun bouton « Appliquer ».
  await expect(page.locator('.token-row')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Appliquer/ })).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Zones cliquables' }),
  ).toContainText('WCAG 2.5.8');
});

test('couleurs : vérifier pour un profil, appliquer la proposition, aperçu simulé', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  // Depuis le contrôle, « Corriger dans Couleurs » ouvre la bonne ligne.
  await page.getByRole('button', { name: /^Accessibilité/ }).click();
  await page
    .getByRole('region', { name: 'Vision classique', exact: true })
    .getByRole('button', { name: 'Corriger dans Couleurs' })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Couleurs' })).toBeVisible();
  const row = page.locator('#row-color-border');
  await expect(row).toContainText('À corriger');
  await row.getByRole('button', { name: /^Appliquer/ }).click();
  await expect(row).not.toContainText('À corriger');
  await expect(
    page.getByRole('button', { name: 'Enregistrer (1)' }),
  ).toBeVisible();
  // Un daltonisme choisi s'applique aussi à l'aperçu ; le ✕ revient à la normale.
  const frame = page.locator('iframe[title="Aperçu responsive"]');
  await page.getByLabel('Type de vision').selectOption('deuteranopia');
  await expect(frame).toHaveCSS('filter', /cvd-deuteranopia/);
  await expect(page.locator('.vision-chip')).toContainText('Deutéranopie');
  await page.getByLabel('Type de vision').selectOption('achromatopsia');
  await expect(frame).toHaveCSS('filter', 'grayscale(1)');
  await page
    .getByRole('button', { name: 'Revenir à la vision normale' })
    .click();
  await expect(frame).toHaveCSS('filter', 'none');
  await expect(page.getByLabel('Type de vision')).toHaveValue('aa');
});

test('aperçu : Comparer affiche deux formats qui suivent les modifications', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Comparer' }).click();
  await expect(page.getByRole('button', { name: 'Comparer' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const left = page.frameLocator('iframe[title="Aperçu Mobile 375 px"]');
  const right = page.frameLocator('iframe[title="Aperçu Grand écran 1440 px"]');
  await page.getByLabel('Couleur de marque', { exact: true }).fill('#AA2200');
  for (const f of [left, right])
    await expect(
      f.getByRole('button', { name: 'Garder ce logement', exact: true }),
    ).toHaveCSS('background-color', 'rgb(170, 34, 0)');
  await page.getByLabel('Format droite').selectOption('tab');
  await expect(
    page.locator('iframe[title="Aperçu Tablette 768 px"]'),
  ).toHaveAttribute('width', '768');
  await page.getByRole('button', { name: 'Comparer' }).click();
  await expect(page.locator('iframe')).toHaveCount(1);
});

test('visite guidée : 7 étapes, ouverte au premier lancement, relancée avec « ? »', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const tour = page.getByRole('dialog', { name: 'Ton Design System' });
  await expect(tour).toBeVisible();
  await expect(tour).toContainText('Étape 1 sur 7');
  const next = () =>
    page.getByRole('button', { name: 'Suivant', exact: true }).click();
  await next();
  // Le contrôle vient juste après la modification, avant d'enregistrer.
  await expect(
    page.getByRole('dialog', { name: 'Contrôle l’accessibilité' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Contrôle d’accessibilité' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tour')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Couleurs' })).toBeVisible();
  // Vue une fois : ne se rouvre pas seule.
  await page.reload();
  await expect(page.locator('.tour')).toHaveCount(0);
  await page.getByRole('button', { name: 'Visite guidée' }).click();
  await expect(tour).toBeVisible();
  for (let i = 0; i < 4; i++) await next();
  await expect(page.getByRole('dialog', { name: 'Compare' })).toBeVisible();
  await expect(page.locator('.compare-stage')).toHaveCount(1);
  await next();
  await expect(page.getByRole('dialog', { name: 'Relie Figma' })).toBeVisible();
  await expect(page.locator('.compare-stage')).toHaveCount(0);
  await next();
  await expect(page.locator('#chat-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.locator('.tour')).toHaveCount(0);
  // L'atelier revient comme avant : chat fermé, sans comparaison.
  await expect(page.locator('#chat-panel')).toBeHidden();
  await expect(page.locator('.compare-stage')).toHaveCount(0);
});

test('aperçu : Avant / après compare l’enregistré et les modifs en cours', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByLabel('Couleur de marque', { exact: true }).fill('#AA2200');
  await page.getByRole('button', { name: 'Comparer' }).click();
  await page.getByRole('button', { name: 'Avant / après' }).click();
  const before = page.frameLocator('iframe[title="Aperçu avant"]');
  const after = page.frameLocator('iframe[title="Aperçu après"]');
  const keep = { name: 'Garder ce logement', exact: true };
  const saved = String((await state(page)).tokens['color.brand'].$value);
  const rgb = saved
    .slice(1)
    .match(/../g)!
    .map((x) => parseInt(x, 16))
    .join(', ');
  await expect(before.getByRole('button', keep)).toHaveCSS(
    'background-color',
    `rgb(${rgb})`,
  );
  await expect(after.getByRole('button', keep)).toHaveCSS(
    'background-color',
    'rgb(170, 34, 0)',
  );
  // Ce qui change à gauche, l'enregistré à droite.
  await expect(page.locator('.compare-cell figcaption').nth(0)).toContainText(
    'Après · 1 modif en cours',
  );
  await expect(page.locator('.compare-cell figcaption').nth(1)).toContainText(
    'Avant · enregistré',
  );
  // En rouvrant Comparer, on repart sur les deux formats.
  await page.getByRole('button', { name: 'Comparer' }).click();
  await page.getByRole('button', { name: 'Comparer' }).click();
  await expect(page.getByRole('button', { name: 'Formats' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('badge d’alerte : icône en plus du rouge (WCAG 1.4.1)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.frameLocator('iframe').locator('.ds-badge.danger svg'),
  ).toHaveCount(1);
});

test('paramètres : onglets, apparence appliquée et mémorisée, Échap', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Paramètres' }).click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Apparence' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog.getByRole('tab', { name: 'Assistants IA' }).click();
  // Claude en carte ; Codex et Gemini réduits à une ligne « Bientôt ».
  await expect(dialog.getByText('Claude', { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(/Bientôt : Codex \(ChatGPT\), Gemini/),
  ).toBeVisible();
  // Claude : Terminal sur Mac, sinon la commande à taper. Les autres : bientôt.
  const claude = dialog.locator('.agent-card', { hasText: 'Claude' });
  await claude
    .getByRole('button', { name: /Connecter|Changer de compte/ })
    .click();
  await expect(claude.locator('.agent-result')).toContainText(
    /claude|Terminal ouvert/,
  );
  await expect(dialog.locator('.agent-card')).toHaveCount(1);
  await dialog.getByRole('tab', { name: 'Apparence' }).click();
  // « Au choix » ouvre le sélecteur de couleur de l'atelier.
  await dialog.getByRole('button', { name: 'Fond au choix' }).click();
  await expect(
    dialog.getByRole('dialog', { name: 'Couleur : Fond' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    dialog.getByRole('dialog', { name: 'Couleur : Fond' }),
  ).toHaveCount(0);
  await expect(dialog).toBeVisible();
  // Couleur du logo au choix : même sélecteur, appliquée au carré du logo.
  await dialog
    .getByRole('button', { name: 'Couleur du logo au choix' })
    .click();
  await dialog.getByLabel('Code HEX : Couleur du logo').fill('#118855');
  await page.keyboard.press('Enter');
  await expect(page.locator('.wordmark .brand-symbol')).toHaveCSS(
    'background-color',
    'rgb(17, 136, 85)',
  );
  await page.keyboard.press('Escape');
  // Recherche de police.
  await dialog.getByLabel('Rechercher une police').fill('futura');
  await expect(dialog.locator('.font-pick')).toHaveCount(1);
  await dialog.getByLabel('Rechercher une police').fill('');
  await dialog.getByRole('button', { name: 'Bleu' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--accent')
          .trim(),
      ),
    )
    .toBe('#3B6FF5');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.reload();
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--accent')
        .trim(),
    ),
  ).toBe('#3B6FF5');
  // Le Design System n'est pas touché par l'apparence de l'atelier.
  expect((await state(page)).tokens['color.brand'].$value).not.toBe('#3B6FF5');
  await page.getByRole('button', { name: 'Paramètres' }).click();
  await page.getByRole('tab', { name: 'Figma' }).click();
  // Figma simulé dans les tests : connecté, mais aucun lien de fichier.
  await expect(page.getByText('Connecté', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Lire depuis Figma' }),
  ).toBeDisabled();
  await page.getByRole('tab', { name: 'Général' }).click();
  await page.getByLabel('Format d’aperçu au démarrage').selectOption('xl');
  await page.getByRole('button', { name: 'Fermer les paramètres' }).click();
  await expect(
    page.getByRole('button', { name: 'Grand écran 1440 px' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('token ajouté à la main : diff « nouveau token », ligne « Ajouté », suppression', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Espacements/ }).click();
  await page.getByRole('button', { name: '+ Ajouter un token' }).click();
  await page.getByLabel('Nom du token').fill('xl');
  await page.getByLabel('Valeur', { exact: true }).fill('40');
  await page.getByRole('button', { name: 'Voir le diff' }).click();
  await expect(diff(page)).toBeVisible();
  await expect(diff(page).getByText('nouveau token')).toBeVisible();
  await diff(page)
    .getByRole('button', { name: /Valider|Enregistrer/ })
    .click();
  await expect(diff(page)).not.toBeVisible();
  const row = page.locator('#row-space-xl');
  await expect(row.getByText('Ajouté')).toBeVisible();
  expect((await state(page)).tokens['space.xl']).toEqual({
    $type: 'dimension',
    $value: 40,
  });
  await row.getByRole('button', { name: /Supprimer le token/ }).click();
  await expect(diff(page).getByText('supprimé')).toBeVisible();
  await diff(page)
    .getByRole('button', { name: /Valider|Enregistrer/ })
    .click();
  await expect(row).toHaveCount(0);
  expect((await state(page)).tokens['space.xl']).toBeUndefined();
});

test('Figma (simulé) : lire en diff, puis envoyer avec aperçu et validation', async ({
  page,
}) => {
  await page.goto('/');
  const pill = page.getByRole('button', { name: 'Figma', exact: true });
  // Pastille : orange tant qu'aucun fichier n'est lié, verte ensuite.
  await expect(pill).toHaveAttribute('data-figma', 'off');
  await expect(pill).toHaveAttribute('title', 'Figma à connecter');
  // Le lien se règle dans Paramètres › Figma (la bulle y mène).
  await pill.click();
  const settings = page.getByRole('dialog', { name: 'Paramètres' });
  await expect(settings.getByRole('tab', { name: 'Figma' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await settings
    .getByLabel('Lien du fichier Figma')
    .fill(
      'https://www.figma.com/design/A7nqzQVmFo6pLvDMB7aWHg/Gutt?node-id=1-7',
    );
  await settings.getByRole('button', { name: 'Enregistrer le lien' }).click();
  await expect(settings.getByText('Lien enregistré.')).toBeVisible();
  await expect(
    settings.getByRole('link', { name: /Ouvrir le fichier dans Figma/ }),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Fermer les paramètres' }).click();
  await expect(pill).toHaveAttribute('data-figma', 'ok');
  await expect(pill).toHaveAttribute('title', 'Figma connecté');
  await pill.click();
  await settings.getByRole('button', { name: 'Lire depuis Figma' }).click();
  // Le diff habituel s'ouvre : rien n'est écrit avant validation.
  await expect(diff(page)).toBeVisible();
  await expect(diff(page).getByText('Lu dans Figma')).toBeVisible();
  await expect(diff(page).getByText('color.warning')).toBeVisible();
  const before = await state(page);
  expect(before.tokens['color.warning']).toBeUndefined();
  await diff(page)
    .getByRole('button', { name: /Valider|Enregistrer/ })
    .click();
  await expect(diff(page)).not.toBeVisible();
  expect((await state(page)).tokens['color.warning'].$value).toBe('#9A5B00');
  // Les composants du fichier apparaissent, liés aux tokens.
  await page.getByRole('button', { name: 'Tag (Figma)' }).click();
  const planche = page.getByRole('region', { name: 'Planche : Tag' });
  await expect(planche.getByText('Variantes lues dans Figma')).toBeVisible();
  await expect(planche.getByText('Red flag')).toBeVisible();
  await expect(planche.getByText('Type : Alerte')).toBeVisible();
  await expect(
    page.getByText('Lu dans Figma : rendu approximatif'),
  ).toBeVisible();
  await expect(
    page.getByLabel('Couleur d’alerte', { exact: true }),
  ).toBeVisible();
  // Envoi : aperçu des variables à écrire, puis validation explicite.
  await page.getByRole('button', { name: 'Figma', exact: true }).click();
  await settings.getByRole('button', { name: 'Envoyer vers Figma' }).click();
  const preview = settings.getByLabel('Changements prévus dans Figma');
  await expect(preview).toBeVisible();
  await expect(preview.getByText('space/md')).toBeVisible();
  await preview.getByRole('button', { name: 'Mettre à jour Figma' }).click();
  await expect(
    settings.getByText(/Figma mis à jour : \d+ variables/),
  ).toBeVisible();
  await expect(preview).toHaveCount(0);
  await settings.getByRole('button', { name: 'Envoyer vers Figma' }).click();
  await expect(
    settings.getByText(
      'Figma a déjà toutes les valeurs enregistrées de l’atelier.',
    ),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Fermer les paramètres' }).click();
  // Enregistrer envoie aussi vers Figma (case cochée), avec un message.
  await page.getByRole('button', { name: /^Couleurs/ }).click();
  await page.getByLabel('Couleur de marque', { exact: true }).fill('#2244AA');
  await page.getByRole('button', { name: /^Enregistrer/ }).click();
  await expect(diff(page).getByLabel('Envoyer aussi vers Figma')).toBeChecked();
  await diff(page)
    .getByRole('button', { name: /Valider|Enregistrer/ })
    .click();
  await expect(page.getByText(/Envoyé à Figma ✓ · 1 variable/)).toBeVisible();
  await page.getByRole('button', { name: 'Figma', exact: true }).click();
  await settings.getByRole('button', { name: 'Envoyer vers Figma' }).click();
  await expect(
    settings.getByText(
      'Figma a déjà toutes les valeurs enregistrées de l’atelier.',
    ),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Fermer les paramètres' }).click();
  // Lire Figma en un clic depuis l'en-tête : rien de nouveau.
  const read = page.getByRole('button', { name: /^Lire Figma/ });
  await read.click();
  await expect(page.getByText('Figma : rien de nouveau ✓')).toBeVisible();
  await expect(read.locator('.figma-read-age')).toHaveText('à l’instant');
  // Enregistré sans envoi : à l'ouverture, l'app voit l'écart toute seule.
  await page.getByLabel('Couleur de marque', { exact: true }).fill('#225522');
  await page.getByRole('button', { name: /^Enregistrer/ }).click();
  await diff(page).getByLabel('Envoyer aussi vers Figma').uncheck();
  await diff(page)
    .getByRole('button', { name: /Valider|Enregistrer/ })
    .click();
  await page.reload();
  await expect(read).toHaveAccessibleName('Lire Figma, 1 nouveauté');
  await read.click();
  await expect(diff(page).getByText('Lu dans Figma')).toBeVisible();
  await expect(diff(page).getByText('color.brand')).toBeVisible();
  await diff(page).getByRole('button', { name: 'Ne pas appliquer' }).click();
  // Le chat attend la fin d'une lecture Figma au lieu de « déjà en cours ».
  await page.route('**/api/agents', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'claude', available: true, detail: 'Claude simulé.' },
      ]),
    }),
  );
  await page.route('**/api/agent', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Réponse simulée.', proposal: null }),
    }),
  );
  await page.route('**/api/figma/pull', async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    await route.continue();
  });
  await page.reload();
  await expect(read).toHaveAccessibleName('Lire Figma : lecture en cours');
  await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
  await page.getByLabel('Ta demande').fill('Une question');
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('Lecture Figma en cours, ta demande part juste après…'),
  ).toBeVisible();
  await expect(page.getByText('Réponse simulée.')).toBeVisible();
  await page.evaluate(() => localStorage.setItem('ds-studio-figma-auto', '1'));
});

test('assistant : historique gardé, nouvelle conversation, réouverture', async ({
  page,
}) => {
  const sent: Record<string, unknown>[] = [];
  await page.route('**/api/agents', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'claude', available: true, detail: 'Claude simulé.' },
      ]),
    }),
  );
  await page.route('**/api/agent', async (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Réponse simulée.', proposal: null }),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
  await page.getByLabel('Ta demande').fill('Première question');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Réponse simulée.')).toBeVisible();
  // Après rechargement, la conversation est toujours là.
  await page.reload();
  await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
  await expect(page.getByText('Première question')).toBeVisible();
  // Nouvelle conversation : vide, et rien de l'ancienne n'est renvoyé.
  await page.getByRole('button', { name: /Nouvelle conversation/ }).click();
  await expect(page.getByText('Première question')).toHaveCount(0);
  await page.getByLabel('Ta demande').fill('Deuxième');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Réponse simulée.')).toBeVisible();
  expect(sent.at(-1)?.history).toEqual([]);
  // Liste des conversations : 2, on rouvre la première.
  await page.getByRole('button', { name: /^Conversations/ }).click();
  const list = page.locator('#chat-list li');
  await expect(list).toHaveCount(2);
  await list
    .filter({ hasText: 'Première question' })
    .locator('.chat-list-open')
    .click();
  await expect(page.getByText('Première question')).toBeVisible();
  await expect(page.getByText('Deuxième')).toHaveCount(0);
});

test('projets : créer, changer, verrou si modifs en cours', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /Gutt \(PFE\)/ });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('list', { name: 'Projets' })).toContainText(
    'Gutt (PFE)',
  );
  await page
    .getByRole('button', { name: 'Nouveau projet', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  await dialog.getByLabel('Nom du projet').fill('Projet test');
  await expect(dialog.getByText('Copier Gutt (PFE)')).toBeVisible();
  await dialog.getByText('Partir de zéro').click();
  await dialog.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('button', { name: /Projet test/ })).toBeVisible();
  expect((await state(page)).revision).toBe(0);
  // Départ neutre (pas les couleurs de Gutt), nom du projet dans l'aperçu.
  expect((await state(page)).tokens['color.brand'].$value).toBe('#3A3A3A');
  await expect(
    page
      .frameLocator('iframe[title="Aperçu responsive"]')
      .locator('.scenario-head strong'),
  ).toHaveText('Projet test');
  await expect(page.getByText('Projet « Projet test » créé.')).toBeVisible();
  await page.getByRole('button', { name: 'Remplir le brief' }).click();
  await expect(page.getByText('Projet « Projet test » créé.')).toBeHidden();
  await page.keyboard.press('Escape');
  // Modif en cours : changer de projet est bloqué, avec la raison.
  await page.getByLabel('Couleur de marque', { exact: true }).fill('#8A3B20');
  await page.getByRole('button', { name: /Projet test/ }).click();
  await expect(
    page.getByText('Enregistre ou annule tes modifications'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Gutt \(PFE\)/ }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Annuler les modifications non enregistrées' })
    .click();
  // Retour sur Gutt.
  await page.getByRole('button', { name: /Projet test/ }).click();
  await page.getByRole('button', { name: /^Gutt \(PFE\)/ }).click();
  await expect(
    page.getByRole('button', { name: /Gutt \(PFE\)/ }),
  ).toBeVisible();
  // Le changement recharge la page : on attend que le serveur l'ait pris.
  await expect
    .poll(
      async () =>
        (await (await page.request.get('/api/projects')).json()).current,
    )
    .toBe('gutt');
  const list = await (await page.request.get('/api/projects')).json();
  expect(list.projects).toHaveLength(2);
});

test('paramètres : nom et logo de l’app, mode sombre, projets', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paramètres' }).click();
  const dialog = page.getByRole('dialog', { name: 'Paramètres' });
  await dialog.getByLabel('Nom de l’app').fill('Atelier Max');
  await dialog.getByRole('button', { name: 'Initiales', exact: true }).click();
  await expect(page.locator('.wordmark strong')).toHaveText('Atelier Max');
  await expect(page.locator('.wordmark .brand-symbol')).toHaveText('AM');
  await expect(page).toHaveTitle('Atelier Max · Atelier local');
  await dialog.getByRole('button', { name: 'Sombre', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  // Projets : créer un second projet par l'API, le renommer puis le supprimer.
  await page.evaluate(async () => {
    const boot = await (await fetch('/api/bootstrap')).json();
    const headers = {
      'content-type': 'application/json',
      'x-ds-studio': boot.csrf,
    };
    await fetch('/api/projects/create', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'École', from: 'neutre' }),
    });
    await fetch('/api/projects/open', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'gutt' }),
    });
  });
  await page.reload();
  // Identité et mode gardés après rechargement.
  await expect(page.locator('.wordmark strong')).toHaveText('Atelier Max');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  // Accès direct depuis le menu de projet.
  await page.locator('.project-trigger').click();
  await page.getByRole('button', { name: 'Renommer ou supprimer…' }).click();
  await expect(dialog.getByRole('tab', { name: 'Projets' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const rows = dialog.locator('.projects-list li');
  await expect(dialog.getByLabel('Nom du projet École')).toBeVisible();
  const before = await rows.count();
  await dialog.getByLabel('Nom du projet École').fill('Projet école');
  await dialog.getByRole('button', { name: 'Renommer' }).click();
  await expect(
    dialog.getByText('Projet renommé : Projet école.'),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /Supprimer Gutt/ }),
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Supprimer Projet école' }).click();
  await dialog.getByRole('button', { name: 'Oui, supprimer' }).click();
  await expect(
    dialog.getByText(/supprimé\. Son dossier est gardé/),
  ).toBeVisible();
  await expect(rows).toHaveCount(before - 1);
  await dialog.getByRole('button', { name: 'Ouvrir le dossier' }).click();
  await expect(
    dialog.getByText(/Dossier ouvert|Ouverture impossible/),
  ).toBeVisible();
  await dialog.getByRole('tab', { name: 'Apparence' }).click();
  await dialog.getByRole('button', { name: 'Revenir à DS-Studio' }).click();
  await expect(page.locator('.wordmark strong')).toHaveText('DS-Studio');
});

test('composant : planche à gauche, écran cohérent et contour à droite', async ({
  page,
}) => {
  await page.goto('/');
  const frame = page.frameLocator('iframe[title="Aperçu responsive"]');
  // Formulaire : l'Aperçu passe sur l'écran qui le contient et l'entoure.
  await page.getByRole('button', { name: 'Formulaire', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Ajouter un logement/ }).first(),
  ).toBeVisible();
  await expect(frame.locator('html')).toHaveAttribute('data-focus', 'form');
  await expect(frame.locator('[data-ds="form"]')).toHaveCSS(
    'outline-style',
    'dashed',
  );
  await expect(page.getByText('Formulaire · 1 sur cet écran')).toBeVisible();
  // Boutons : planche des 12 états à gauche, survol et focus visibles.
  await page.getByRole('button', { name: 'Boutons', exact: true }).click();
  const sheet = page.getByRole('region', { name: 'Planche : Boutons' });
  await expect(sheet.locator('.ds-button')).toHaveCount(12);
  await expect(sheet.locator('.ds-button.primary.is-hover')).toHaveCSS(
    'background-color',
    'rgb(36, 63, 153)',
  );
  await expect(sheet.locator('.ds-button.primary.is-focus')).toHaveCSS(
    'outline-style',
    'solid',
  );
  await expect(sheet).toContainText('arrondi');
  // En bas des tokens, la planche reste visible et suit la taille du texte.
  await page.getByLabel('Taille du texte', { exact: true }).fill('20');
  await expect(sheet).toBeInViewport();
  await expect(sheet).toContainText('texte 20 px');
  await page.getByLabel('Taille du texte', { exact: true }).fill('16');
  // Fit / 100 % : la planche passe à la taille réelle, puis zoom + / −.
  const sheetZoom = sheet.getByRole('group', { name: 'Zoom de la planche' });
  await sheetZoom.getByRole('button', { name: /revenir à 100 %/ }).click();
  await expect(sheet).toContainText('taille réelle');
  await sheetZoom.getByRole('button', { name: 'Zoomer', exact: true }).click();
  await expect(sheetZoom.locator('.zoom-value')).toHaveText('125 %');
  // Vue zoomée : glisser déplace la planche de droite à gauche.
  const box = (await sheet.locator('.fit-box').boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 60, { steps: 5 });
  await page.mouse.up();
  expect(
    await sheet.locator('.fit-box').evaluate((el) => el.scrollLeft),
  ).toBeGreaterThan(0);
  await sheetZoom.getByRole('button', { name: /revenir à 100 %/ }).click();
  // Le contour suit le composant ouvert.
  await expect(frame.locator('html')).toHaveAttribute('data-focus', 'buttons');
  await expect(page.getByText(/Boutons · \d+ sur cet écran/)).toBeVisible();
  // Un token modifié change la planche tout de suite.
  await page.getByRole('button', { name: /^Couleurs/ }).click();
  await expect(frame.locator('html')).not.toHaveAttribute('data-focus', /.+/);
  await page.getByLabel('Couleur de marque', { exact: true }).fill('#8A3B20');
  await page.getByRole('button', { name: 'Boutons', exact: true }).click();
  await expect(sheet.locator('.ds-button.primary').first()).toHaveCSS(
    'background-color',
    'rgb(138, 59, 32)',
  );
});

test('composants : planche des états pour chaque composant', async ({
  page,
}) => {
  await page.goto('/');
  const open = async (name: string) => {
    await page.getByRole('button', { name, exact: true }).click();
    const sheet = page.getByRole('region', { name: `Planche : ${name}` });
    await expect(sheet).toContainText('Tous les états');
    return sheet;
  };
  const fiche = await open('Fiche logement');
  await expect(fiche.locator('.ds-card')).toHaveCount(2);
  await expect(fiche).toContainText('Logement gardé ✓');
  const points = await open('Points à vérifier');
  await expect(points.getByRole('progressbar')).toHaveCount(3);
  await expect(points).toContainText('0 / 5 vérifiés');
  await expect(points).toContainText('5 / 5 vérifiés');
  const form = await open('Formulaire');
  await expect(form.locator('input:not([type])')).toHaveCount(5);
  await expect(form.locator('input.is-invalid')).not.toHaveCSS(
    'border-top-color',
    await form
      .locator('input:not([type])')
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopColor),
  );
  await expect(form.locator('input.is-focus').first()).toHaveCSS(
    'outline-style',
    'solid',
  );
  const nav = await open('Navigation');
  await expect(nav.locator('.ds-nav button')).toHaveCount(3);
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(nav).toContainText('onglet min. 44 px');
});

test('survol : proposé quand la marque change, suppression assombrie', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Boutons', exact: true }).click();
  const sheet = page.getByRole('region', { name: 'Planche : Boutons' });
  // Suppression : le survol se distingue du normal.
  const danger = sheet.locator('.ds-button.danger');
  const normal = await danger
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(sheet.locator('.ds-button.danger.is-hover')).not.toHaveCSS(
    'background-color',
    normal,
  );
  // Marque changée : le survol est proposé, rien n'est appliqué seul.
  await page.getByRole('button', { name: /^Couleurs/ }).click();
  await page.getByLabel('Couleur de marque', { exact: true }).fill('#8A3B20');
  const hover = page.locator('#row-color-brandHover');
  await expect(hover).toContainText('La marque a changé, pas son survol.');
  await expect(
    page.getByLabel('Marque au survol', { exact: true }),
  ).toHaveValue('#243F99');
  await hover.getByRole('button', { name: /^Appliquer/ }).click();
  await expect(
    page.getByLabel('Marque au survol', { exact: true }),
  ).not.toHaveValue('#243F99');
  await expect(hover).not.toContainText('La marque a changé');
  await page
    .getByRole('button', { name: 'Annuler les modifications non enregistrées' })
    .click();
});
