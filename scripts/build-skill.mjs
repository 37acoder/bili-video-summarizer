import { build } from 'esbuild'
import { access, copyFile, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const skill = join(root, 'skills/video-summarizer')
await import('./package-article-assets.mjs')
await Promise.all(['SKILL.md', 'agents/openai.yaml', 'references/setup.md', 'references/bilibili-auth.md',
  'references/summarization.md', 'references/execution.md', 'references/local-transcription.md', 'references/asr-installation.md', 'references/doubao-transcription.md',
  'references/text-summary.md', 'references/editorial-writing.md', 'references/illustrated-summary.md', 'references/visual-evidence.md',
  'references/article-profiles.md', 'scripts/video.mjs', 'scripts/prepare-article.mjs', 'assets/article/catalog.json']
  .map(file => access(join(skill, file))))
await mkdir(join(skill, 'scripts'), { recursive: true })
await build({ entryPoints: [join(root, 'scripts/doubao-cli.mjs')], outfile: join(skill, 'scripts/doubao-transcribe.cjs'),
  bundle: true, platform: 'node', target: 'node22', format: 'cjs', legalComments: 'eof',
  external: ['bufferutil', 'utf-8-validate'], define: { 'process.env.WS_NO_BUFFER_UTIL': '"1"', 'process.env.WS_NO_UTF_8_VALIDATE': '"1"' } })
await rm(join(skill, 'scripts/doubao-transcribe.py'), { force: true })
await build({ entryPoints: [join(root, 'src/agent/cli.ts')], outfile: join(skill, 'scripts/video-source.cjs'),
  bundle: true, platform: 'node', target: 'node22', format: 'cjs', minify: false, legalComments: 'eof' })
await copyFile(join(root, 'LICENSE'), join(skill, 'LICENSE'))
await copyFile(join(root, 'NOTICE'), join(skill, 'NOTICE'))
await writeFile(join(skill, 'scripts/THIRD-PARTY-NOTICES.txt'),
  (await Promise.all(['qrcode', 'dijkstrajs', 'pngjs', 'ws'].map(async name =>
    `${name}\n${await readFile(join(root, 'node_modules', name,
      name === 'qrcode' ? 'license' : name === 'dijkstrajs' ? 'LICENSE.md' : 'LICENSE'), 'utf8')}\n`))).join('\n').trimEnd() + '\n')
