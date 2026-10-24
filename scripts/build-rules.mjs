// Kopieert de rulesheets van Pinball Rulesheets (pinballrulesheets.com, opvolger van de Tilt Forums-wiki, CC0)
// naar public/rules/ en maakt een index OPDB-groep → bestand. Draait in GitHub Actions vóór build-catalog.
//
// Gebruik: node scripts/build-rules.mjs <pad-naar-clone-van-heyrocker/pinballrules>
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseRulesheet } from './rules-transform.mjs';

const repo = process.argv[2];
const outDir = new URL('../public/rules/', import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });
}

try {
  if (!repo) throw new Error('geen pad naar de pinballrules-repository opgegeven');
  const docs = join(repo, 'docs');
  const index = {};
  let count = 0;
  for (const file of walk(docs)) {
    const sheet = parseRulesheet(readFileSync(file, 'utf8'));
    if (!sheet) continue; // geen opdb_id: geen kast-rulesheet (bijv. lijsten, uitleg)
    const path = relative(docs, file).replace(/\.md$/, '');
    if (index[sheet.opdbGroup]) continue; // eerste rulesheet per kast-groep wint
    mkdirSync(join(outDir, path, '..'), { recursive: true });
    writeFileSync(join(outDir, path + '.md'), sheet.body);
    index[sheet.opdbGroup] = { path, title: sheet.title };
    count++;
  }
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index));
  console.log(`Rulesheets: ${count} kasten met een rulesheet (Pinball Rulesheets, CC0)`);
} catch (err) {
  console.warn('::warning::Rulesheets niet bijgewerkt:', err.message);
}
