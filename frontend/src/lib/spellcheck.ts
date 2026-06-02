import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

export interface SpellError {
  from:        number
  to:          number
  suggestions: string[]
}

const spellCheckKey = new PluginKey<DecorationSet>('spellcheck')

// Recorre el doc y devuelve el texto plano + un mapa textOffset → posición ProseMirror
function extractText(doc: PMNode): { text: string; posMap: number[] } {
  let text   = ''
  const posMap: number[] = []
  let needNl = false

  doc.forEach((block, blockOffset) => {
    if (!block.isBlock) return
    if (needNl) { text += '\n'; posMap.push(-1) }
    needNl = false

    block.descendants((node, nodeOffset) => {
      if (node.isText && node.text) {
        for (let i = 0; i < node.text.length; i++) {
          text += node.text[i]
          posMap.push(blockOffset + 1 + nodeOffset + i)
        }
      }
    })

    if (block.content.size > 0) needNl = true
  })

  return { text, posMap }
}

async function fetchErrors(rawText: string): Promise<SpellError[]> {
  if (!rawText.trim()) return []

  // Reemplaza {{variables}} con espacios del mismo largo para preservar offsets
  const checkText = rawText.replace(/\{\{[^}]+\}\}/g, m => ' '.repeat(m.length))

  try {
    const resp = await fetch('https://api.languagetool.org/v2/check', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ text: checkText, language: 'es' }),
    })
    if (!resp.ok) return []
    const data = await resp.json()

    return (data.matches ?? []).map((m: any) => ({
      offset:      m.offset,
      length:      m.length,
      suggestions: (m.replacements ?? []).slice(0, 5).map((r: any) => r.value),
    }))
  } catch {
    return []
  }
}

export function createSpellCheckExtension(
  onErrors: (errors: SpellError[]) => void
) {
  return Extension.create({
    name: 'spellCheck',

    addProseMirrorPlugins() {
      let timer: ReturnType<typeof setTimeout> | null = null

      return [new Plugin({
        key: spellCheckKey,

        state: {
          init: () => DecorationSet.empty,
          apply(tr, decos) {
            const meta = tr.getMeta(spellCheckKey)
            if (meta !== undefined) return meta
            return decos.map(tr.mapping, tr.doc)
          },
        },

        props: {
          decorations(state) { return this.getState(state) },
        },

        view: (editorView) => ({
          update(view, prevState) {
            if (view.state.doc.eq(prevState.doc)) return
            if (timer) clearTimeout(timer)

            timer = setTimeout(async () => {
              const { text, posMap } = extractText(view.state.doc)
              const matches = await fetchErrors(text)

              const decos:  Decoration[]  = []
              const errors: SpellError[] = []

              for (const m of matches) {
                const from = posMap[m.offset]
                const toIdx = m.offset + m.length - 1
                const to   = toIdx < posMap.length ? posMap[toIdx] : -1

                if (!from || from < 0 || !to || to < 0) continue

                errors.push({ from, to: to + 1, suggestions: m.suggestions })
                decos.push(
                  Decoration.inline(from, to + 1, { class: 'spell-error' })
                )
              }

              onErrors(errors)
              const tr = view.state.tr.setMeta(
                spellCheckKey,
                DecorationSet.create(view.state.doc, decos)
              )
              view.dispatch(tr)
            }, 2000)
          },

          destroy() { if (timer) clearTimeout(timer) },
        }),
      })]
    },
  })
}
