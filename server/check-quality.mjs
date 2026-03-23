import { initDatabase, queryAll } from './db/init.js';

await initDatabase();

const items = queryAll(
  `SELECT h.title, h.source, h.ai_analysis, k.keyword, h.is_verified
   FROM hotspots h 
   LEFT JOIN keywords k ON h.keyword_id = k.id
   WHERE h.is_verified = 1
   ORDER BY h.created_at DESC
   LIMIT 30`
);

console.log(`=== Total verified items: ${items.length} ===\n`);

items.forEach((i, idx) => {
  let a = {};
  try { a = JSON.parse(i.ai_analysis || '{}'); } catch {}
  console.log(`#${idx + 1} [${i.keyword}] conf=${a.confidence} score=${a.heat_score} src=${i.source}`);
  console.log(`  title: ${(i.title || '').slice(0, 100)}`);
  console.log(`  reason: ${(a.reason || '').slice(0, 150)}`);
  console.log();
});

// Also show distribution of confidence scores
const all = queryAll(
  `SELECT h.ai_analysis FROM hotspots h WHERE h.is_verified = 1`
);
const confBuckets = { '0.3-0.5': 0, '0.5-0.7': 0, '0.7-0.9': 0, '0.9-1.0': 0 };
all.forEach(r => {
  try {
    const a = JSON.parse(r.ai_analysis || '{}');
    const c = a.confidence || 0;
    if (c < 0.5) confBuckets['0.3-0.5']++;
    else if (c < 0.7) confBuckets['0.5-0.7']++;
    else if (c < 0.9) confBuckets['0.7-0.9']++;
    else confBuckets['0.9-1.0']++;
  } catch {}
});
console.log('=== Confidence distribution (verified items) ===');
console.log(confBuckets);

// Show keywords
const kws = queryAll('SELECT keyword FROM keywords WHERE enabled = 1');
console.log('\n=== Active keywords ===');
kws.forEach(k => console.log(`  - ${k.keyword}`));

process.exit(0);
