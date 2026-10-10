import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let scratch: string
let skill: string
const prepare = (profile: string, output: string, media?: string) => spawnSync(process.execPath,
  [join(skill, 'scripts/prepare-article.mjs'), '--profile', profile, '--out', output,
    ...(media ? ['--media', media] : [])], { cwd: scratch, encoding: 'utf8' })

beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), 'video-skill-package-'))
  skill = join(scratch, 'video-summarizer')
  await cp(join(repository, 'skills/video-summarizer'), skill, { recursive: true })
})
afterAll(async () => { if (scratch) await rm(scratch, { recursive: true, force: true }) })

describe('portable article skill', () => {
  it('expands the selected profile with usable local style paths outside the repository', async () => {
    const output = join(scratch, 'tech-article')
    const result = prepare('tech', output)
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ profile: 'tech', media: 'video', status: 'unfilled-skeleton' })
    const html = await readFile(join(output, 'summary.html'), 'utf8')
    const links = [...html.matchAll(/<link[^>]*href="([^"]+)"/g)].flatMap(match => match[1] ? [match[1]] : [])
    expect(links.length).toBeGreaterThan(0)
    for (const path of links) expect((await readFile(join(output, path), 'utf8')).length).toBeGreaterThan(0)
    expect((await readFile(join(output, 'summary.md'), 'utf8')).length).toBeGreaterThan(0)
  })

  it('keeps the lecture or interview theme while replacing pictures with an audio index', async () => {
    for (const profile of ['lecture', 'interview', 'recording']) {
      const output = join(scratch, profile + '-audio')
      const result = prepare(profile, output, 'audio')
      expect(result.status, result.stderr).toBe(0)
      const html = await readFile(join(output, 'summary.html'), 'utf8')
      const md = await readFile(join(output, 'summary.md'), 'utf8')
      expect(html).toContain(`data-theme="${profile}"`)
      expect(html).toContain('audio-timeline')
      expect(html).not.toMatch(/<(img|figure)\b/)
      expect(md).not.toMatch(/!\[/)
      expect(md).not.toContain('frameFilename')
      expect(JSON.parse(await readFile(join(output, 'article-config.json'), 'utf8')).media).toBe('audio')
    }
  })

  it('preserves an existing article when asked to reuse its output directory', async () => {
    const output = join(scratch, 'existing')
    await mkdir(output)
    await writeFile(join(output, 'summary.html'), 'existing user article')
    expect(prepare('tech', output).status).not.toBe(0)
    expect(await readFile(join(output, 'summary.html'), 'utf8')).toBe('existing user article')
  })
})
