import os
import re

patterns = [
    re.compile(r'password\s*[:=]\s*["\'][^"\']+["\']', re.I),
    re.compile(r'secret\s*[:=]\s*["\'][^"\']+["\']', re.I),
    re.compile(r'api_?key\s*[:=]\s*["\'][^"\']+["\']', re.I),
    re.compile(r'access_?token\s*[:=]\s*["\'][^"\']+["\']', re.I),
    re.compile(r'private_?key', re.I),
    re.compile(r'postgres://', re.I),
    re.compile(r'jdbc:postgresql://', re.I)
]

ignored_dirs = {'.git', 'node_modules', 'target', '.system_generated', 'ai_env', 'venv', '.idea', 'dist'}

findings = []

for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ignored_dirs]
    for f in files:
        if f.endswith(('.py', '.java', '.yml', '.yaml', '.properties', '.json', '.jsx', '.js', '.env', '.env.example', '.md', '.sql')):
            p = os.path.join(root, f)
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as fh:
                    for idx, line in enumerate(fh):
                        for pat in patterns:
                            if pat.search(line):
                                findings.append((p, idx + 1, line.strip()))
                                break
            except Exception as e:
                pass

print(f"Total Findings Found: {len(findings)}")
for p, lnum, line in findings:
    print(f"  {p}:{lnum} -> {line[:100]}")
