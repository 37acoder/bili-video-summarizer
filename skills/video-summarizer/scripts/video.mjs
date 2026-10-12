import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const scripts = dirname(fileURLToPath(import.meta.url))
const [command, ...rest] = process.argv.slice(2)
const routes = { source: 'video-source.cjs', doubao: 'doubao-transcribe.cjs', article: 'prepare-article.mjs' }
async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw Error('NODE_VERSION_UNSUPPORTED: use Node.js >=22')
  if (!command || command === '--help') {
    console.log('Video summary — one Node.js entrypoint\n  env                    Check runtime and packaged scripts (offline)\n  auth | prepare | inspect | verify-summary | asr   Subtitle/local-ASR commands\n  doubao doctor|download|prepare|inspect             Optional cloud ASR\n  article --profile <id> --out <new-directory>      Expand one article template')
    return
  }
  if (command === 'env') {
    const missing = []
    for (const file of Object.values(routes)) { try { await access(join(scripts, file)) } catch { missing.push(file) } }
    console.log(JSON.stringify({ ready: !missing.length, nodeVersion: process.versions.node, skillDirectory: dirname(scripts), entrypoint: fileURLToPath(import.meta.url), missingScripts: missing }))
    if (missing.length) process.exitCode = 1
    return
  }
  const route = command === 'doubao' || command === 'article' ? command : 'source'
  const child = spawn(process.execPath, [join(scripts, routes[route]), ...(route === 'source' ? [command, ...rest] : rest)], { stdio: 'inherit' })
  const forward = signal => child.kill(signal)
  const interrupt = () => forward('SIGINT'), terminate = () => forward('SIGTERM')
  process.on('SIGINT', interrupt); process.on('SIGTERM', terminate)
  try { await new Promise((done, reject) => { child.once('error', reject); child.once('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); done() }) }) }
  finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate) }
}
main().catch(error => { console.error(JSON.stringify({ error: error.code === 'ENOENT' ? 'SKILL_SCRIPT_MISSING' : error.message })); process.exitCode = 1 })
