const fs = require('fs');
const linesToFix = [143, 422, 451, 2019, 3633, 5045, 5371, 5377, 5987, 6225, 6238, 6288, 6473, 6889];
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
for (const line of linesToFix) {
    if (lines[line - 1].includes('catch (e) {')) {
        lines[line - 1] = lines[line - 1].replace('catch (e) {', 'catch {');
    }
}
fs.writeFileSync('src/App.tsx', lines.join('\n'));
