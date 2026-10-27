import { test, expect, type Page } from '@playwright/test';

const state = async (page: Page) =>
  (await page.request.get('/api/state')).json();
const diff = (page: Page) =>
  page.getByRole('dialog', { name: 'Valider les changements' });

test('boucle centrale : aperçu immédiat, diff, validation, recharge, retour en arrière ciblé', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Design System', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Figma non connecté', { exact: true }),
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
  const main = page
    .locator('.ds-pane')
    .getByRole('button', { name: 'Action principale', exact: true });
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
  await page.getByRole('button', { name: '100 %', exact: true }).click();
  expect(await holder.evaluate((el) => el.clientWidth)).toBeGreaterThanOrEqual(
    1280,
  );
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
  await expect(
    page.getByText('Contraste texte sur marque : 1.00:1', { exact: false }),
  ).toContainText('contraste à améliorer');
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
  await brief
    .getByLabel('Nom du PFE', { exact: true })
    .fill('Mon atelier accessible');
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
  await expect(brief.getByLabel('Nom du PFE', { exact: true })).toHaveValue(
    'Mon atelier accessible',
  );
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
          error: 'Validation de session manquante. Rechargez la page.',
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
  await expect(drawer).toContainText('Vous pouvez revenir en arrière');
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
  await expect(page.getByLabel('Votre demande')).toBeFocused();
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
  await page.getByLabel('Votre demande').fill('Bonjour');
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

test('audit d’accessibilité : score, contrastes et zones cliquables', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /^Accessibilité/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Test d’accessibilité' }),
  ).toBeVisible();
  await expect(page.locator('.audit-score')).toContainText(/\d+ %/);
  await expect(
    page.getByRole('region', { name: 'Contrastes' }).locator('li'),
  ).toHaveCount(12);
  // Mesure faite dans l'écran affiché par l'aperçu.
  await expect(
    page.getByRole('region', { name: 'Zones cliquables' }),
  ).toContainText('WCAG 2.5.8');
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

test('vision des couleurs : filtre sur l’aperçu, étiquette et retour', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /^Accessibilité/ }).click();
  const frame = page.locator('iframe[title="Aperçu responsive"]');
  await page.getByRole('radio', { name: 'Deutéranopie' }).click();
  await expect(
    page.getByRole('radio', { name: 'Deutéranopie' }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(frame).toHaveCSS('filter', /cvd-deuteranopia/);
  await expect(page.locator('.vision-chip')).toContainText('Deutéranopie');
  await page.getByRole('radio', { name: 'Sans couleur' }).click();
  await expect(frame).toHaveCSS('filter', 'grayscale(1)');
  await page
    .getByRole('button', { name: 'Revenir à la vision normale' })
    .click();
  await expect(frame).toHaveCSS('filter', 'none');
  await expect(page.locator('.vision-chip')).toHaveCount(0);
});

test('menu : catégories repliables, mémorisées, élément affiché gardé', async ({
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
  // L'élément affiché reste visible même si sa catégorie est repliée.
  await nav.getByRole('button', { name: /^Tokens/ }).click();
  await expect(nav.getByRole('button', { name: /^Couleurs/ })).toBeVisible();
  await expect(nav.getByRole('button', { name: /^Typographie/ })).toHaveCount(
    0,
  );
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
