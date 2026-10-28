// Garde PreToolUse de Claude Code pour la synchro Figma de DS-Studio.
// N'autorise qu'un seul appel use_figma, sur le fichier prévu, avec exactement
// le script généré par l'atelier (empreinte SHA-256). Tout le reste est bloqué
// avant d'atteindre Figma (code de sortie 2).
import { createHash } from 'node:crypto';
import { openSync, closeSync } from 'node:fs';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (b) => (raw += b));
process.stdin.on('end', () => {
  const refuse = (why) => {
    process.stderr.write(`DS-Studio a bloqué cet appel : ${why}`);
    process.exit(2);
  };
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return refuse('évènement illisible.');
  }
  if (event.tool_name !== 'mcp__figma__use_figma')
    return refuse('seul use_figma est permis.');
  const input = event.tool_input ?? {};
  if (input.fileKey !== process.env.DS_FIGMA_FILE)
    return refuse('fichier Figma différent.');
  const hash = createHash('sha256')
    .update(String(input.code ?? ''))
    .digest('hex');
  if (hash !== process.env.DS_FIGMA_EXPECT)
    return refuse('script différent de celui préparé par l’atelier.');
  // Un seul passage : le fichier témoin est créé de façon exclusive.
  try {
    closeSync(openSync(process.env.DS_FIGMA_ONCE, 'wx'));
  } catch {
    return refuse('appel déjà effectué.');
  }
  process.exit(0);
});
