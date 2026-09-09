/** Delivery syntax belongs to Connector, not to Workspace or an agent runtime.
 * Code spans/fences and escaped brackets are literal examples. */
export function parseReplyDirectives(text: string): { text: string; files: string[]; silent: boolean } {
  const files: string[] = []
  let silent = false
  // Mask code first by consuming it in the same scan as executable markers.
  const result = text.replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n\1[^\n]*(?:\n|$)|$)|(`+)[\s\S]*?\2|\\\[\[|\[\[(no-reply|file:([^\]\n]+))\]\]/g,
    (match, _fence, _inline, directive: string | undefined, path: string | undefined) => {
      if (!directive) return match
      if (directive === 'no-reply') { silent = true; return match }
      const clean = path?.trim()
      if (!clean) return match
      if (!files.includes(clean)) files.push(clean)
      return ''
    })
  return { text: result.trim(), files, silent }
}
