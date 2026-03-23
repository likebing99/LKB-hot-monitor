import { initDatabase, queryOne } from './db/init.js';
await initDatabase();
const k = queryOne("SELECT value FROM settings WHERE key = 'openrouter_api_key'");
console.log('key exists:', !!k?.value, 'length:', k?.value?.length);
