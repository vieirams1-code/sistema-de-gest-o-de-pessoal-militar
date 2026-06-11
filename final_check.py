import re

with open('src/pages/LotacaoMilitares.jsx', 'r') as f:
    lines = f.readlines()

content = "".join(lines)

# Extract all names from imports
imports = []
# Named imports { a, b as c }
named_import_re = re.compile(r'import\s+\{(.*?)\}\s+from')
for match in named_import_re.finditer(content):
    parts = match.group(1).split(',')
    for p in parts:
        p = p.strip()
        if not p: continue
        if ' as ' in p:
            imports.append(p.split(' as ')[1].strip())
        else:
            imports.append(p.strip())

# Default imports
default_import_re = re.compile(r'import\s+(\w+)\s+from')
for match in default_import_re.finditer(content):
    imports.append(match.group(1))

for name in sorted(set(imports)):
    # Count occurrences of the word.
    # We expect at least 1 (the import). If it's used, should be > 1.
    count = len(re.findall(r'\b' + name + r'\b', content))
    if count == 1:
        print(f"UNUSED: {name}")
    # else:
    #    print(f"USED ({count}): {name}")
