import re

file_path = r"c:\Users\Vaibhav\antigravity\New folder\theiakshi-enterprise\src\components\attendance\AttendanceView.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

bad_func = re.search(r"function calculateDistanceMeters.*?return Math\.round\(R \* c\);\s*}", content, re.DOTALL)
if bad_func:
    new_func = """function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }"""
    content = content.replace(bad_func.group(0), new_func)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced function")
else:
    print("Function not found")
