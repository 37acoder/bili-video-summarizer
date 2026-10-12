// Documentation screenshots only; requires an installed agent-browser + Chromium.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'docs/assets/readme');
const categories = join(root, 'examples/illustrated-summary/categories');
const { profiles } = JSON.parse(readFileSync(join(categories, 'profiles.json'), 'utf8'));
let session;

function browser(args, input) {
  const result = spawnSync('agent-browser', session ? ['--session', session, ...args] : args, {
    cwd: root, encoding: 'utf8', input, timeout: 30000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
function evaluate(code) {
  return browser(['eval', '--stdin'], `(() => { ${code} })()`);
}
function screenshot(name) {
  console.log(browser(['screenshot', join(output, `${name}.png`)]));
}
const prepareCapture = `
  document.documentElement.style.scrollBehavior = 'auto';
  const style = document.createElement('style');
  style.textContent = '::-webkit-scrollbar { display: none; }';
  document.head.append(style);
`;

try {
  session = browser(['session', 'id', '--scope', 'worktree', '--prefix', 'readme-showcase']);
  mkdirSync(output, { recursive: true });
  browser(['open', pathToFileURL(join(root, 'examples/illustrated-summary/summary.html')).href]);
  browser(['set', 'viewport', '1200', '2000']);
  browser(['wait', '--fn', 'Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)']);
  evaluate(`${prepareCapture}
    if (document.images.length !== 6) throw new Error('Expected six original frames');
    if (document.documentElement.scrollWidth > innerWidth) throw new Error('Article overflows');
    window.scrollTo({ top: 0, behavior: 'instant' });
  `);
  screenshot('summary');
  browser(['set', 'viewport', '1200', '300']);
  evaluate(`
    const card = document.querySelector('.commentary');
    window.scrollTo({ top: window.scrollY + card.getBoundingClientRect().top - 16, behavior: 'instant' });
  `);
  browser(['wait', '--fn', 'Math.abs(document.querySelector(".commentary").getBoundingClientRect().top - 16) < 1']);
  screenshot('commentary');

  browser(['open', pathToFileURL(join(categories, 'index.html')).href]);
  browser(['set', 'viewport', '1024', '1400']);
  browser(['wait', '--fn', `document.querySelectorAll('#switcher button').length === ${profiles.length}`]);
  // Leave room below short previews so each capture starts at the same offset.
  evaluate(`${prepareCapture} document.body.style.paddingBottom = '1400px';`);
  for (const profile of profiles) {
    browser(['click', `button[data-id="${profile.id}"]`]);
    evaluate(`
      const preview = document.querySelector('#preview');
      if (preview.dataset.theme !== ${JSON.stringify(profile.id)}) throw new Error('Wrong theme');
      if (document.documentElement.scrollWidth > innerWidth) throw new Error('Template overflows');
      if (${JSON.stringify(profile.id)} === 'recording' && document.querySelector('.shot'))
        throw new Error('Audio preview must not contain an image placeholder');
      if (${JSON.stringify(profile.id)} === 'drama' && document.querySelector('.spoiler').open)
        throw new Error('Spoilers must start collapsed');
      window.scrollTo({ top: window.scrollY + preview.getBoundingClientRect().top - 20, behavior: 'instant' });
    `);
    browser(['wait', '--fn', 'Math.abs(document.querySelector("#preview").getBoundingClientRect().top - 20) < 1']);
    screenshot(profile.id);
  }
} finally {
  if (session) browser(['close']);
}
