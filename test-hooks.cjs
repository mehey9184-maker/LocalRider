const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
let insideApp = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('export function App() {')) insideApp = true;
  if (!insideApp) continue;
  if (line.startsWith('}')) {
    if (i > 9100) insideApp = false;
  }
  
  const match = line.match(/\b([A-Z][a-zA-Z0-9_]*)\(/g);
  if (match) {
    for (const m of match) {
      const name = m.slice(0, -1);
      if (!['String', 'Number', 'Boolean', 'Date', 'Set', 'Map', 'Promise', 'Array', 'Object', 'Error', 'Request', 'Blob', 'URL', 'Event', 'Math', 'SpeechRecognition'].includes(name) && !line.includes('new ' + name)) {
        console.log(`Line ${i+1}: ${line.trim()}`);
      }
    }
  }
}
