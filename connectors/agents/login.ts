import { spawn } from 'node:child_process';

// Connexion d'un assistant depuis les Paramètres : l'atelier ouvre le Terminal
// avec la commande officielle du fournisseur. C'est le CLI qui gère le compte ;
// l'atelier ne lit, ne reçoit et ne stocke aucun identifiant.
// Liste fermée : aucune donnée venant du navigateur n'entre dans la commande.
// figma : ajoute le serveur MCP officiel de Figma à Claude Code puis ouvre
// Claude Code, où « /mcp » lance la connexion OAuth au compte Figma.
export const loginCommands = {
  claude: 'claude',
  figma:
    'claude mcp add --transport http --scope user figma https://mcp.figma.com/mcp; claude /mcp',
} as const;
export type LoginAgent = keyof typeof loginCommands;

export type TerminalOpener = (command: string) => Promise<boolean>;

// macOS : ouvre une fenêtre du Terminal qui lance la commande.
// Ailleurs : rien n'est lancé, l'atelier affiche la commande à taper.
export const openTerminal: TerminalOpener = async (command) => {
  if (process.platform !== 'darwin') return false;
  if (!Object.values(loginCommands).includes(command as never)) return false;
  return new Promise((resolve) => {
    const child = spawn(
      'osascript',
      [
        '-e',
        'tell application "Terminal" to activate',
        '-e',
        `tell application "Terminal" to do script "${command}"`,
      ],
      { stdio: 'ignore' },
    );
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
};
