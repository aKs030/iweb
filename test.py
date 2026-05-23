import re
with open("pages/home/home.css", "r") as f:
    text = f.read()

print(re.findall(r'\.section3__cta\s*{[^}]+}', text))
