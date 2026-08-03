import fs from 'fs';
import { dict } from './src/utils/i18n.js';
const keys = fs.readFileSync('extract_keys.txt', 'utf8').split('\n').filter(Boolean);
const missing = [];
for (const key of keys) {
  if (!dict.en[key]) {
    missing.push(key);
  }
}
console.log(`Found ${missing.length} missing keys in 'en'.`);
console.log(missing);
