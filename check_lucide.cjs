const fs = require('fs');
const content = fs.readFileSync('src/pages/CadastrarAtestado.jsx', 'utf8');
const lucideMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+'lucide-react'/);
if (lucideMatch) {
  const icons = lucideMatch[1].split(',').map(i => {
    const parts = i.trim().split(/\s+as\s+/);
    return parts[parts.length - 1];
  });
  icons.forEach(icon => {
    const regex = new RegExp('\\b' + icon + '\\b', 'g');
    const matches = (content.match(regex) || []).length;
    console.log(icon + ': ' + matches);
  });
}
