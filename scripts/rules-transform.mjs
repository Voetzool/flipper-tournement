// Leest een rulesheet uit de Pinball Rulesheets-repository: YAML-kop met title/manufacturer/opdb_id + Markdown.

/** @returns {{title: string, opdbGroup: string, body: string} | null} */
export function parseRulesheet(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return null;
  const field = (name) => {
    const f = new RegExp('^' + name + ':\\s*"?([^"\\r\\n]*)"?\\s*$', 'm').exec(m[1]);
    return f ? f[1].trim() : '';
  };
  // opdb_id kan een groep ("GRo7K") of een volledige id ("GRo7K-MxxXx") zijn; we koppelen op groep.
  const opdbGroup = field('opdb_id').split('-')[0];
  if (!/^G[A-Za-z0-9]{4}$/.test(opdbGroup)) return null;
  return { title: field('title'), opdbGroup, body: m[2].trim() + '\n' };
}
