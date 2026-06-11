import re

with open('src/pages/CadastrarAtestado.jsx', 'r') as f:
    lines = f.readlines()

identifiers = []
for line in lines:
    if line.strip().startswith('import'):
        # match symbols inside braces
        braced = re.search(r'\{([^}]+)\}', line)
        if braced:
            symbols = braced.group(1).split(',')
            for s in symbols:
                s = s.strip()
                if not s: continue
                if ' as ' in s:
                    identifiers.append(s.split(' as ')[1].strip())
                else:
                    identifiers.append(s)
        else:
            # match default import
            m = re.search(r'import\s+(\w+)\s+from', line)
            if m:
                identifiers.append(m.group(1))

content = "".join(lines)
for id in identifiers:
    matches = re.findall(r'\b' + id + r'\b', content)
    if len(matches) == 1:
        print(f"UNUSED: {id}")
