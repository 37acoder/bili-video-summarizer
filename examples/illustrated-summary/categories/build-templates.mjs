import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(root, 'profiles.json'), 'utf8'));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const token = value => `{{${value}}}`;
for (const p of [...catalog.profiles, ...(catalog.extensions || [])]) {
  const chapter = (_name, index) => `<section class="section" data-origin="source"><h2>${token(`章节标题_${index + 1}_具体问题或观点`)}</h2><p>${token(`原片内容_${index + 1}_经历例子与推理_保留归属与限定`)}</p></section>`;
  const comment = `<aside class="commentary" data-origin="commentary" aria-label="AI评论"><div class="comment-head"><span class="comment-badge">✦ ${escape(p.commentLabel)}</span><span>AI观点 · 非原片内容</span></div><h3>${token('评论标题')}</h3><p>${token('从具体原片依据展开推理_给出条件性判断_按共用行文自检')}</p></aside>`;
  const figure = `<figure class="shot"><img src="assets/${token('frameFilename')}" alt="${token('实际可见内容')}" style="width:100%;height:auto"><figcaption>${token('自然图注_具体可见内容及它帮助理解什么')}</figcaption></figure>`;
  const audio = `<section class="audio-index" data-origin="source"><h2>回听索引</h2><p class="audio-note">${token('真实录音场景_覆盖范围_身份与时间不确定性')}</p><ol class="audio-timeline"><li><span class="audio-time">${token('实际时间_不明则标时间待确认')}</span><div><b>${token('说话者_身份不明用A或B')}</b><p>${token('该时间段议题与发言_保留归属')}</p><a href="${token('实际可用的回听链接_无则省略链接')}">回听这段</a></div></li></ol><p class="audio-note">${token('仅列明确提及的决定_负责人_期限_缺失时注明未明确_无则省略')}</p></section>`;
  const media = p.mediaMode === 'audio' ? `<details class="sources"><summary>回听索引</summary>${audio}</details>` : figure;
  const focus = '';
  const remaining = p.structure.slice(1).map((name, i) => chapter(name, i + 1)).join('\n') + media + comment;
  const plot = p.spoilerPolicy === 'hide-plot-by-default' ? `<p class="warning">后续包含剧情转折与观后解读。默认收起；展开后才显示完整内容。</p><details class="spoiler"><summary>展开剧情与观后想法（含剧透）</summary>${remaining}</details>` : remaining;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${token('视频原标题_逐字保留')}</title><link rel="stylesheet" href="../base.css"><link rel="stylesheet" href="../themes.css"></head><body class="template-page"><main class="preview" data-theme="${p.id}"><article class="article"><header class="hero"><p class="eyebrow">${escape(p.symbol)} ${escape(p.name)} / ${escape(p.label)}</p><h1>${token('视频原标题_逐字保留')}</h1><p class="lead">${token('从原片的具体问题经历或短原话进入主题')}</p></header><div class="content">${chapter(p.structure[0],0)}${focus}${plot}<div class="sources"><details><summary>来源与回看</summary><p><a href="${token('sourceUrl')}">原片</a> · ${token('素材依据与真实时长_缺失则省略')}</p><p>${token('完整或部分覆盖_实际缺口与转录疑点')}</p><p>${token('实际主题回看链接_图片来源与实际时间')}</p></details></div></div></article></main></body></html>\n`;
  writeFileSync(join(root, 'templates', `${p.id}.html`), html);
  const mediaMarkdown = p.mediaMode === 'audio'
    ? `<details>\n<summary>回听索引</summary>\n\n${token('实际时间_已确认说话者_议题与回听入口_缺失时注明')}\n\n</details>`
    : `![${token('实际可见内容')}](assets/${token('frameFilename')})\n\n*${token('自然图注_具体可见内容及它帮助理解什么')}*`;
  const prose = `# ${token('视频原标题_逐字保留，不加前后缀')}\n\n${token('从原片的具体问题经历或短原话进入主题')}\n\n${p.structure.map((_name,i)=>`## ${token(`章节标题_${i+1}_具体问题或观点`)}\n\n${token(`原片内容_${i+1}_经历例子与推理_保留归属与限定`)}\n`).join('\n')}\n${mediaMarkdown}\n\n> **✦ ${p.commentLabel}｜${token('评论标题')}**\n>\n> **AI观点 · 非原片内容。**\n>\n> ${token('从具体原片依据展开推理，给出条件性判断；按共用行文自检，可增设引用段落')}\n\n<details>\n<summary>来源与回看</summary>\n\n原片：[${token('视频原标题')}](${token('sourceUrl')})。\n\n${token('文字和视觉覆盖_识别来源_实际缺口与疑点')}\n\n${token('实际主题回看链接_图片来源与实际时间')}\n\n</details>\n\n<!-- structure是取材提示，按内容增删章节并拟定实际小标题。写作：${p.voice} 评论：${p.commentStyle} 选图：${p.imageStrategy} 无有效画面时删去图片块。注意：${p.avoid} -->\n`;
  const md = p.spoilerPolicy === 'hide-plot-by-default'
    ? prose.replace(`## ${token('章节标题_2_具体问题或观点')}`, `**剧透提示：** 后续进入完整剧情。无剧透版本删去转折、结果及相关图片和评论。\n\n## ${token('章节标题_2_具体问题或观点')}`)
    : prose;
  writeFileSync(join(root, 'templates', `${p.id}.md`), md);
}
writeFileSync(join(root, 'gallery-data.js'), `// Generated from profiles.json; all demo content is synthetic.\nwindow.VIDEO_SUMMARY_CATEGORIES = ${JSON.stringify(catalog.profiles, null, 2)};\n`);
console.log(`Generated ${catalog.profiles.length} primary profiles, ${(catalog.extensions || []).length} extensions, HTML/Markdown templates and local gallery data.`);
