// Pinball Tournament-server voor een Raspberry Pi (of andere pc).
// Start: PORT=80 DATA_DIR=/var/lib/pinball-tournament node server.mjs
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPinballServer } from './app';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 80);
const dataDir = process.env.DATA_DIR ?? join(here, 'data');
const staticDir = process.env.STATIC_DIR ?? (existsSync(join(here, 'public')) ? join(here, 'public') : join(here, '..', 'dist-server', 'public'));

const { server } = await createPinballServer({ staticDir, dataDir });
server.listen(port, () => {
  console.log(`Pinball Tournament draait op poort ${port} (gegevens: ${dataDir})`);
});
