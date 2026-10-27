import { z } from 'zod';
// Importé en premier : pas d'évaluation dynamique dans le navigateur,
// la CSP interdit eval et Zod sait s'en passer.
z.config({ jitless: true });
