import re

with open('src/pages/Ferias.jsx', 'r') as f:
    lines = f.readlines()

content = "".join(lines)

# Find all lines with 'import'
import_lines = [l for l in lines if 'import' in l and 'from' in l]

for line in import_lines:
    # Named imports
    named = re.search(r'\{([^}]+)\}', line)
    if named:
        parts = named.group(1).split(',')
        for p in parts:
            p = p.strip()
            if not p: continue
            if ' as ' in p:
                alias = p.split(' as ')[1].strip()
                original = p.split(' as ')[0].strip()
            else:
                alias = p
                original = p

            # Count occurrences in the whole file
            count = len(re.findall(r'\b' + re.escape(alias) + r'\b', content))
            if count == 1:
                print(f"UNUSED Named: {alias} (original: {original}) in line: {line.strip()}")
    else:
        # Default imports
        match = re.search(r'import\s+([^\s{]+)\s+from', line)
        if match:
            name = match.group(1).strip()
            count = len(re.findall(r'\b' + re.escape(name) + r'\b', content))
            if count == 1:
                print(f"UNUSED Default: {name} in line: {line.strip()}")
