import re

file_path = r"c:\Users\Vaibhav\antigravity\New folder\theiakshi-enterprise\src\components\attendance\AttendanceView.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pagination_controls = """            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing page {page} of {totalPages} (Total: {total})
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>"""

content = content.replace("              </table>\n            </div>\n          </div>", "              </table>\n            </div>\n" + pagination_controls + "\n          </div>")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Added pagination controls")
