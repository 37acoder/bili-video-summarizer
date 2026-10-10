import { build } from 'esbuild'
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const skill = join(root, 'skills/video-summarizer')
await import('./package-article-assets.mjs')
await Promise.all(['SKILL.md', 'agents/openai.yaml', 'references/setup.md', 'references/bilibili-auth.md',
  'references/summarization.md', 'references/local-transcription.md', 'references/asr-installation.md',
  'references/text-summary.md', 'references/illustrated-summary.md', 'references/visual-evidence.md',
  'references/article-profiles.md', 'scripts/prepare-article.mjs', 'assets/article/catalog.json']
  .map(file => access(join(skill, file))))
await mkdir(join(skill, 'scripts'), { recursive: true })
await build({ entryPoints: [join(root, 'src/agent/cli.ts')], outfile: join(skill, 'scripts/video-source.cjs'),
  bundle: true, platform: 'node', target: 'node22', format: 'cjs', minify: false, legalComments: 'eof' })
await copyFile(join(root, 'LICENSE'), join(skill, 'LICENSE'))
await copyFile(join(root, 'NOTICE'), join(skill, 'NOTICE'))
await writeFile(join(skill, 'scripts/THIRD-PARTY-NOTICES.txt'),
  (await Promise.all(['qrcode', 'dijkstrajs', 'pngjs'].map(async name =>
    `${name}\n${await readFile(join(root, 'node_modules', name,
      name === 'qrcode' ? 'license' : name === 'dijkstrajs' ? 'LICENSE.md' : 'LICENSE'), 'utf8')}\n`))).join('\n').trimEnd() + '\n')
