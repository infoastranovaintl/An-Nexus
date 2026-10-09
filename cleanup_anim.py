import re, os

base = os.getcwd()

files = [
    'src/views/dashboard/DashboardView.tsx',
    'src/views/sensors/SensorsView.tsx',
    'src/views/cctv/CctvView.tsx',
    'src/views/alerts/AlertsView.tsx',
    'src/views/settings/SettingsView.tsx',
    'src/views/connections/ConnectionsView.tsx',
    'src/views/messages/MessagesView.tsx',
    'src/components/layout/Shell.tsx',
]

for filepath in files:
    full_path = os.path.join(base, filepath)
    if not os.path.exists(full_path):
        print(f"SKIP (missing): {filepath}")
        continue
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove anim-* classes (one or more space-separated tokens starting with anim-)
    content = re.sub(r'\s+anim-[\w-]+', '', content)
    # also handle anim- at start of class string after an opening quote
    content = re.sub(r'"\s*anim-[\w-]+', '"', content.replace('anim-fade-in', ''))

    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Cleaned {filepath}")

print("Done")
