import { expect, it } from 'vitest'
import { parseReplyDirectives as parse } from './reply-directives.js'
it('extracts explicit file references and deduplicates, preserving ordinary links', () => {
  expect(parse('Report [[file:reports/日报.pdf]] [[file:reports/日报.pdf]] [[daily]]')).toEqual({
    text: 'Report   [[daily]]', files: ['reports/日报.pdf'], silent: false,
  })
})
it('keeps code, escaped brackets and incomplete directives literal', () => {
  for (const text of ['`[[file:a]]`', '`example\n[[file:a]]`', '```text\n[[file:a]]\n```', '~~~\n[[no-reply]]\n~~~', '\\[[file:a]]', '[[file:unfinished']) {
    expect(parse(text)).toEqual({ text, files: [], silent: false })
  }
})
it('recognizes silence without interpreting its source', () => {
  expect(parse('[[no-reply]] quiet').silent).toBe(true)
  expect(parse('`[[no-reply]]`').silent).toBe(false)
})
