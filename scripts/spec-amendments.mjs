import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export function loadAmendments(root, source, hash) {
  const ids = new Set([...source.matchAll(/^\| ([A-Z]+-\d+) \*\*/gm)].map(x => x[1]));
  const amendments = readdirSync(join(root, 'docs/changes')).filter(x => /^A-\d+.*\.json$/.test(x)).sort().map(file => {
    const raw = readFileSync(join(root, 'docs/changes', file), 'utf8').replaceAll('\r\n', '\n');
    return { ...JSON.parse(raw), digest: createHash('sha256').update(raw).digest('hex').toUpperCase() };
  }).filter(x => x.status === 'Approved');
  if (new Set(amendments.map(x => x.id)).size !== amendments.length) throw new Error('Duplicate approved amendment ID');
  for (const amendment of amendments) {
    if (!/^A-\d+$/.test(amendment.id) || amendment.source !== 'Client' || !amendment.decisionId || !amendment.date ||
        amendment.sourceSha256 !== hash || !amendment.requirementIds?.length || amendment.requirementIds.some(id => !ids.has(id))) {
      throw new Error(`Invalid approved amendment ${amendment.id}`);
    }
    if (!amendment.replacements?.length) throw new Error(`Missing replacements ${amendment.id}`);
    for (const replacement of amendment.replacements) {
      if (!replacement.before || !replacement.after || replacement.before === replacement.after ||
          source.split(replacement.before).length !== 2 || !replacement.views?.length ||
          replacement.views.some(view => !/^\d{2}-[a-z-]+$/.test(view))) throw new Error(`Stale amendment replacement ${amendment.id}`);
    }
  }
  return amendments;
}

export function amendmentNotice(amendments) {
  return amendments.length ? `<!-- Approved client amendments: ${amendments.map(x => `${x.id} SHA-256 ${x.digest}`).join('; ')}. Frozen source preserved; records in docs/changes. -->\n\n` : '';
}

export function amendmentsForView(amendments, name) {
  return amendments.filter(x => x.replacements.some(replacement => replacement.views.includes(name)));
}

export function amendView(body, name, amendments) {
  const active = amendmentsForView(amendments, name);
  for (const amendment of active) {
    for (const replacement of amendment.replacements.filter(x => x.views.includes(name))) {
      if (body.split(replacement.before).length !== 2) throw new Error(`Cannot apply ${amendment.id} to ${name}`);
      body = body.replace(replacement.before, replacement.after);
    }
  }
  return amendmentNotice(active) + body;
}
