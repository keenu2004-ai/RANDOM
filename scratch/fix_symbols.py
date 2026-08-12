import re

file_path = r"c:\Users\Vaibhav\antigravity\New folder\theiakshi-enterprise\src\components\attendance\AttendanceView.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix mangled symbols
content = content.replace("const I+1 = (lat1 * Math.PI) / 180;", "const phi1 = (lat1 * Math.PI) / 180;")
content = content.replace("const I+2 = (lat2 * Math.PI) / 180;", "const phi2 = (lat2 * Math.PI) / 180;")
content = content.replace('const I"I+ = ((lat2 - lat1) * Math.PI) / 180;', "const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;")
content = content.replace('const I"I = ((lon2 - lon1) * Math.PI) / 180;', "const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;")
content = content.replace('Math.sin(I"I+ / 2) * Math.sin(I"I+ / 2) +', "Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +")
content = content.replace('Math.cos(I+1) * Math.cos(I+2) * Math.sin(I"I / 2) * Math.sin(I"I / 2);', "Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Fixed symbols")
