// Folds the preview build into one HTML page (styles and script inline),
// written to dist-preview/swaraveda-preview.html.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'dist-preview'
let html = readFileSync(join(dir, 'index.html'), 'utf8')

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, file) =>
  `<style>${readFileSync(join(dir, file), 'utf8')}</style>`)
html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, file) =>
  `<script type="module">${readFileSync(join(dir, file), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`)
html = html.replace(/<link rel="icon"[^>]*>\s*/, '')

// The page is served inside a document that already has <html>, <head> and <body>.
const head = html.match(/<head>([\s\S]*)<\/head>/)[1]
const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
const scripts = head.match(/<script type="module">[\s\S]*?<\/script>/g) ?? []
const rest = scripts.reduce((h, s) => h.replace(s, ''), head)
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '')
const out = `${rest.trim()}\n${body.trim()}\n${scripts.join('\n')}\n`
writeFileSync(join(dir, 'swaraveda-preview.html'), out)
console.log(`dist-preview/swaraveda-preview.html  ${(out.length / 1024).toFixed(0)} kB`)
