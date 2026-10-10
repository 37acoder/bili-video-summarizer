// Generated skill assets come from the reviewed example catalog; edit that source.
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import '../examples/illustrated-summary/categories/build-templates.mjs'
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(root, 'examples/illustrated-summary/categories')
const destination = join(root, 'skills/video-summarizer/assets/article')
const catalog = JSON.parse(await readFile(join(source, 'profiles.json'), 'utf8'))
await mkdir(join(destination, 'profiles'), { recursive: true })
await mkdir(join(destination, 'templates'), { recursive: true })
await Promise.all(['base.css', 'themes.css'].map(file => copyFile(join(source, file), join(destination, file))))
const profiles = [...catalog.profiles, ...(catalog.extensions || [])]
for (const profile of profiles) {
  const { demo, ...contract } = profile
  await writeFile(join(destination, 'profiles', profile.id + '.json'), JSON.stringify({ version: catalog.version, ...contract }, null, 2) + '\n')
  await Promise.all(['html', 'md'].map(extension => copyFile(join(source, 'templates', `${profile.id}.${extension}`), join(destination, 'templates', `${profile.id}.${extension}`))))
}
await writeFile(join(destination, 'catalog.json'), JSON.stringify({ version: catalog.version, source: 'examples/illustrated-summary/categories/profiles.json', profiles: catalog.profiles.map(({id,label})=>({id,label})), extensions: (catalog.extensions || []).map(({id,label})=>({id,label})) }, null, 2)+'\n')
console.log(`Packaged ${profiles.length} article template pairs and per-profile writing contracts.`)
