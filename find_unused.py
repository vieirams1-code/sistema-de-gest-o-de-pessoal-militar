import re
import sys

file_path = 'src/pages/CadastrarAtestado.jsx'
with open(file_path, 'r') as f:
    content = f.read()

import_pattern = re.compile(r'import\s+(?:\{([^}]*)\}|([^{}\s;]+))\s+from\s+[\'"]([^\'"]+)[\'"]', re.MULTILINE)
imports = import_pattern.findall(content)

all_imported_names = []
for curly, single, source in imports:
    if curly:
        names = [n.strip() for n in curly.split(',')]
        for name in names:
            if not name: continue
            if ' as ' in name:
                all_imported_names.append(name.split(' as ')[1].strip())
            else:
                all_imported_names.append(name)
    elif single:
        all_imported_names.append(single.strip())

unused = []
for name in all_imported_names:
    count = len(re.findall(r'\b' + name + r'\b', content))
    if count == 1:
        unused.append(name)

print(unused)
