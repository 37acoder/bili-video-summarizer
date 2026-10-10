import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises'
import { dirname, join, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const skill = dirname(dirname(fileURLToPath(import.meta.url)))
const help = 'Usage: node prepare-article.mjs --profile <id> --out <absolute-new-directory> [--media video|audio]\nCopies one reviewed HTML/Markdown skeleton and local CSS; fill placeholders with verified content.\n'
async function run() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('--help')) { process.stdout.write(help); return }
  const options = {}
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1]
    if (!['--profile', '--out', '--media'].includes(key) || !value || value.startsWith('--') || options[key]) throw Error('Invalid or duplicate option; use --help')
    options[key] = value
  }
  const root = join(skill, 'assets/article')
  const catalog = JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8'))
  const selected = [...catalog.profiles, ...catalog.extensions].find(p => p.id === options['--profile'])
  if (!selected) throw Error('Unknown profile; see references/article-profiles.md')
  if (!options['--out'] || !isAbsolute(options['--out'])) throw Error('--out must be an absolute new directory with an existing parent')
  const profile = JSON.parse(await readFile(join(root, 'profiles', selected.id + '.json'), 'utf8'))
  const media = options['--media'] || (profile.mediaMode === 'audio' ? 'audio' : 'video')
  if (!['video', 'audio'].includes(media) || (profile.mediaMode === 'audio' && media !== 'audio')) throw Error('Invalid media for this profile')
  let html = await readFile(join(root, 'templates', selected.id + '.html'), 'utf8')
  let md = await readFile(join(root, 'templates', selected.id + '.md'), 'utf8')
  html = html.replaceAll('href="../base.css"', 'href="base.css"').replaceAll('href="../themes.css"', 'href="themes.css"')
  if (media === 'audio' && profile.mediaMode !== 'audio') {
    // A transformation of our fixed skeleton, not a general Markdown/HTML parser.
    const htmlIndex = '<section class="audio-index" data-origin="source"><h2>回听索引</h2><p class="audio-note">{{可靠时间与已确认身份_缺失时明确标注}}</p><ol class="audio-timeline"><li><span class="audio-time">{{实际时间_不明则用议题索引}}</span><div><b>{{议题或已确认说话者}}</b><p>{{该段原片内容_保留归属}}</p></div></li></ol></section>'
    html = html.replace(/<figure class="shot">[\s\S]*?<\/figure>/, htmlIndex)
    const imageStart = md.indexOf('![{{实际可见内容}}]')
    const imageEnd = md.indexOf('\n\n> **✦', imageStart)
    if (imageStart < 0 || imageEnd < 0) throw Error('Template image block not found')
    md = md.slice(0, imageStart) + '## 回听索引\n\n{{可靠时间_议题或已确认说话者_该段内容_缺失时明确标注}}' + md.slice(imageEnd)
  }
  const output = resolve(options['--out'])
  await mkdir(output) // Fails if it exists; never merges old article state.
  try {
    await mkdir(join(output, 'assets'))
    const writes = await Promise.allSettled([
      writeFile(join(output, 'summary.html'), html), writeFile(join(output, 'summary.md'), md),
      ...['base.css', 'themes.css'].map(file => copyFile(join(root, file), join(output, file))),
      writeFile(join(output, 'article-config.json'), JSON.stringify({ templateVersion: catalog.version, profile: selected.id, media, status: 'unfilled-skeleton' }, null, 2) + '\n')
    ])
    const failure = writes.find(result => result.status === 'rejected')
    if (failure) throw failure.reason
  } catch (error) { await rm(output, {recursive:true,force:true}); throw error }
  process.stdout.write(JSON.stringify({ directory: output, profile: selected.id, media, status: 'unfilled-skeleton' }) + '\n')
}
run().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1 })
