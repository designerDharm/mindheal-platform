import fs from 'fs';

const filePath = './src/utils/i18n.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update langCodes
const langCodesRegex = /export const langCodes = \{[\s\S]*?\};/;
const newLangCodes = `export const langCodes = {
  "English": "en",
  "Hindi": "hi",
  "Arabic": "ar"
};`;
content = content.replace(langCodesRegex, newLangCodes);

// 2. Remove unwanted language blocks from dict
const unwantedLangs = ["ta", "te", "gu", "pa"];

for (const lang of unwantedLangs) {
  // Regex to find the start of the language block: e.g. "ta": {
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
    
    // Find the end index of this block. If followed by a comma and newline, we remove those too.
    let endIdx = idx;
    if (content[endIdx] === ',') {
      endIdx++;
    }
    // Also skip any trailing whitespace/newlines
    while (endIdx < content.length && (content[endIdx] === '\n' || content[endIdx] === '\r' || content[endIdx] === ' ')) {
      endIdx++;
    }

    // Determine the start index. We want to remove from the start of the key match.
    // Let's also check if there is leading whitespace/newlines before the match.
    let startIdx = match.index;
    while (startIdx > 0 && (content[startIdx - 1] === ' ' || content[startIdx - 1] === '\n' || content[startIdx - 1] === '\r')) {
      startIdx--;
    }

    content = content.slice(0, startIdx) + "\n" + content.slice(endIdx);
  }
}

// Write the cleaned-up file back
fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully cleaned up unwanted languages from i18n.js!");
