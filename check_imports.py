import re
import sys

def check_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find all imports
    # This is a bit naive but should work for common patterns
    import_pattern = re.compile(r'import\s+\{(.*?)\}\s+from\s+[\'"](.*?)[\'"]', re.DOTALL)
    imports = import_pattern.findall(content)

    # Also find single imports
    single_import_pattern = re.compile(r'import\s+(\w+)\s+from\s+[\'"](.*?)[\'"]')
    single_imports = single_import_pattern.findall(content)

    all_imported_names = []
    for names, source in imports:
        # Split by comma and handle 'as'
        for name in names.split(','):
            name = name.strip()
            if not name: continue
            if ' as ' in name:
                all_imported_names.append(name.split(' as ')[1].strip())
            else:
                all_imported_names.append(name.strip())

    for name, source in single_imports:
        all_imported_names.append(name)

    # Remove duplicates
    all_imported_names = list(set(all_imported_names))

    # Check usage
    unused = []
    for name in all_imported_names:
        # Look for name as a whole word, excluding the import statement itself
        # We'll just count occurrences and see if it's more than 1
        matches = re.findall(r'\b' + re.escape(name) + r'\b', content)
        if len(matches) <= 1:
            unused.append(name)

    return unused

if __name__ == "__main__":
    print(check_file('src/pages/LotacaoMilitares.jsx'))
