import os
for root, dirs, files in os.walk('.'):
    for f in files:
        if f.endswith(('.tsx', '.ts')) and f != 'MapEmptyOverlay.tsx':
            p = os.path.join(root, f)
            with open(p, 'r', errors='ignore') as fh:
                for i, line in enumerate(fh, 1):
                    if 'MapEmptyOverlay' in line:
                        print(f"{p}:{i}: {line.strip()}")
