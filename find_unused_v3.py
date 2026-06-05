import re

def check_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Remove comments
    content_no_comments = re.sub(r'//.*', '', content)
    content_no_comments = re.sub(r'/\*.*?\*/', '', content_no_comments, flags=re.DOTALL)

    # Find all imports
    # Handle multi-line imports by looking for 'import ... from' across multiple lines
    imports = re.findall(r'import\s+(.*?)\s+from\s+[\'"]', content, re.DOTALL)
    imported_names = []
    for imp in imports:
        # Named imports
        named = re.findall(r'\{([^}]+)\}', imp, re.DOTALL)
        for group in named:
            for name in group.split(','):
                name = name.strip()
                if ' as ' in name:
                    imported_names.append(name.split(' as ')[1].strip())
                else:
                    imported_names.append(name)
        # Default/Namespace imports
        remaining = re.sub(r'\{[^}]+\}', '', imp, flags=re.DOTALL).strip()
        if remaining:
            for name in remaining.split(','):
                name = name.strip()
                if ' as ' in name and '*' in name:
                    name = name.split(' as ')[1].strip()
                name = name.replace(',', '').strip()
                if name:
                    imported_names.append(name)

    unused = []
    for name in sorted(list(set(imported_names))):
        if not name: continue
        # Find usage (excluding the import line itself)
        occurrences = re.findall(r'\b' + re.escape(name) + r'\b', content_no_comments)
        if len(occurrences) <= 1:
            # Special case for React in project with new transform
            # even if it's used 0 times, it might be in an import
            unused.append(name)

    return unused

print(check_file('src/pages/Ferias.jsx'))
