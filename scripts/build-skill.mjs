import { build } from 'esbuild'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const skill = join(root, 'skills/video-summarizer')
await mkdir(join(skill, 'scripts'), { recursive: true })
await build({ entryPoints: [join(root, 'src/agent/cli.ts')], outfile: join(skill, 'scripts/video-source.cjs'),
  bundle: true, platform: 'node', target: 'node22', format: 'cjs', minify: false, legalComments: 'eof' })
await copyFile(join(root, 'LICENSE'), join(skill, 'LICENSE'))
await copyFile(join(root, 'NOTICE'), join(skill, 'NOTICE'))
await writeFile(join(skill, 'scripts/THIRD-PARTY-NOTICES.txt'),
  (await Promise.all(['qrcode', 'dijkstrajs', 'pngjs'].map(async name =>
    `${name}\n${await readFile(join(root, 'node_modules', name,
      name === 'qrcode' ? 'license' : name === 'dijkstrajs' ? 'LICENSE.md' : 'LICENSE'), 'utf8')}\n`))).join('\n').trimEnd() + '\n')
