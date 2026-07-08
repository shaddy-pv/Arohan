import io

with open('cv_backend.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('cv_backend.py', 'w', encoding='utf-8') as f:
    for line in lines:
        if 'print' in line and any(ord(c) > 127 for c in line):
            # Keep ascii and newline characters
            line = ''.join(c for c in line if ord(c) <= 127 or ord(c) == 10)
            if 'print(f" ' in line:
                line = line.replace('print(f" ', 'print(f"')
        f.write(line)
