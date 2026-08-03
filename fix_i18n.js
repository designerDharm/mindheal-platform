import fs from 'fs';

const filePath = './src/utils/i18n.js';
let content = fs.readFileSync(filePath, 'utf8');

const missingKeys = [
  'CBT Toolkit',
  'Call AASRA (India): 9820466726',
  'Download The App',
  'Find a Counsellor',
  'Healing, Decoded.',
  'Insights & Articles',
  'Join thousands who have found peace, clarity, and growth with MindHeal.',
  'Learn About Your Mind.',
  'National Emergency: 112',
  'Read All Articles',
  'Your Healing Journey Begins Now.',
  'Your Mind. Your Healing.'
];

const langs = ["en", "hi", "ta", "te", "gu", "pa", "ar"];

for (const lang of langs) {
  // Regex to find the end of the language block. 
  // It looks for `"lang": { ... }` where `}` is followed by `,` or `}`.
  // Actually, simpler: find `"${lang}": {` then find the matching closing brace.
  const langRegex = new RegExp(`"${lang}"\\s*:\\s*\\{`, "g");
  const match = langRegex.exec(content);
  if (match) {
    let braceCount = 1;
    let idx = match.index + match[0].length;
    while (braceCount > 0 && idx < content.length) {
      if (content[idx] === '{') braceCount++;
      if (content[idx] === '}') braceCount--;
      idx++;
    }
    
    // idx - 1 is the closing brace
    const insertPos = idx - 1;
    
    // Check if the previous char is a comma or newline to format nicely
    let newEntries = "";
    for (const key of missingKeys) {
      newEntries += `    "${key}": "${key}",\n`;
    }
    
    content = content.slice(0, insertPos) + ",\n" + newEntries + content.slice(insertPos);
  }
}

// Clean up trailing commas before closing braces if any (optional, JS allows it)
fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated i18n.js with missing keys.");
