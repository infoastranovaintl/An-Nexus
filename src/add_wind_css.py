import os
os.chdir(r'D:\Project\PROJECTS\Astranova\powerhydro\packages\hydropower\src')

with open('index.css', 'r', encoding='utf-8') as f:
    content = f.read()

wind_css = """
/* ── wind glow animation ──────────────────────────── */
@keyframes wind-glow {
  0% {
    opacity: 0.15;
    transform: translateX(-15px);
  }
  50% {
    opacity: 0.6;
    transform: translateX(15px);
  }
  100% {
    opacity: 0.15;
    transform: translateX(-15px);
  }
}
.wind-glow {
  animation: wind-glow 2s ease-in-out infinite;
  will-change: transform, opacity;
}
.wind-streak {
  animation: wind-glow 1.5s ease-in-out infinite;
  will-change: transform, opacity;
}
"""

if 'wind-glow' not in content:
    # Append before the closing of the file or after the last @media block
    content = content.rstrip() + '\n' + wind_css
    with open('index.css', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Wind glow CSS added")
else:
    print("Wind glow CSS already present")
