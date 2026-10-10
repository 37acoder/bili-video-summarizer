/* Local, dependency-free preview. All sample prose uses textContent. */
(() => {
  const profiles = window.VIDEO_SUMMARY_CATEGORIES;
  const nav = document.querySelector('#switcher');
  const article = document.querySelector('#article');
  const brief = document.querySelector('#brief');
  const preview = document.querySelector('#preview');
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function comment(profile) {
    const card = el('aside', 'commentary'); card.dataset.origin = 'commentary';
    card.setAttribute('aria-label', `AI评论：${profile.demo.commentTitle}`);
    const head = el('div', 'comment-head');
    head.append(el('span', 'comment-badge', `✦ ${profile.commentLabel}`), el('span', '', 'AI观点 · 非原片内容'));
    card.append(head, el('h3', '', profile.demo.commentTitle), el('p', '', profile.demo.comment));
    return card;
  }
  function section(value, index) {
    const node = el('section', 'section'); node.dataset.origin = 'source-demo';
    node.append(el('p', 'section-number', `0${index + 1} / 模拟摘要`), el('h2', '', value.heading), el('p', '', value.text));
    return node;
  }
  function media(profile) {
    if (profile.mediaMode === 'audio') {
      const panel = el('section', 'audio-index'); panel.dataset.origin = 'source-demo';
      panel.append(el('h2', '', '回听索引'), el('p', 'audio-note', '合成时间与发言示例 · 非真实录音分析。正式稿只使用可靠时间与已确认身份；缺失时明确标注。'));
      const list = el('ol', 'audio-timeline');
      profile.demo.timeline.forEach(item => {
        const row = el('li'); const content = el('div');
        content.append(el('b', '', item.speaker), el('p', '', item.text));
        row.append(el('span', 'audio-time', item.time), content); list.append(row);
      });
      panel.append(list, el('p', 'audio-note', '本合成示例：未明确负责人或日期，不生成已确认待办。纯音频不强制配图，也不伪造波形。'));
      return panel;
    }
    const figure = el('figure', 'shot'); const shot = el('div', 'shot-placeholder');
    const caption = el('div'); caption.append(el('strong', '', '视频截图占位'), el('span', '', profile.imageStrategy)); shot.append(caption);
    figure.append(shot, el('figcaption', '', '此处仅示范图片排版。正式输出需替换为真实原帧，并提供实际时间、来源与图注；没有有效画面则省略。'));
    return figure;
  }
  function render(profile, updateHash = true) {
    preview.dataset.theme = profile.id; article.replaceChildren(); brief.replaceChildren();
    for (const button of nav.children) button.setAttribute('aria-pressed', String(button.dataset.id === profile.id));
    brief.append(el('p', '', `${profile.label} · ${profile.name}｜${profile.tagline}`), el('p', '', `视觉：${profile.visual}`), el('p', '', `行文：${profile.voice}`));
    const downloads = el('div', 'downloads');
    for (const [label, extension] of [['HTML模板', 'html'], ['Markdown写作模板', 'md']]) {
      const link = el('a', '', label); link.href = `templates/${profile.id}.${extension}`; downloads.append(link);
    }
    const actual = el('a', '', '已有科技真实样例'); actual.href = '../summary.html'; downloads.append(actual); brief.append(downloads);
    const hero = el('header', 'hero');
    hero.append(el('p', 'eyebrow', `${profile.symbol} ${profile.name} / ${profile.label}`), el('span', 'sticker', profile.sticker), el('h1', '', profile.demo.title), el('p', 'lead', profile.demo.lead), el('p', 'meta', '风格样片 · 示例标题非真实视频标题 · 模板 category-v2'));
    article.append(hero, el('p', 'demo-notice', profile.mediaMode === 'audio' ? '合成内容演示：正文、时间与发言均为模拟；不对应真实录音。纯音频版不配图片。' : '合成内容演示：正文为模拟摘要，图片区域为占位；不作为视频事实或视觉理解证据。'), el('p', 'reading-key', '正文：模拟原片整理　/　紫色虚线卡：AI评论，非原片观点'));
    const body = el('div', 'content'); const beats = el('div', 'beats');
    profile.demo.beats.forEach((text, i) => { const beat = el('div', 'beat'); beat.append(el('b', '', `0${i + 1}`), document.createTextNode(text)); beats.append(beat); });
    body.append(beats, section(profile.demo.sections[0], 0));
    if (profile.demo.focus) {
      const focus = el('aside', 'focus-panel'); focus.dataset.origin = 'source-demo';
      focus.append(el('h3', '', profile.demo.focus.label)); const list = el('ul');
      profile.demo.focus.items.forEach(item => list.append(el('li', '', item))); focus.append(list); body.append(focus);
    }
    const figure = media(profile);
    const ending = section(profile.demo.sections[1], 1);
    if (profile.spoilerPolicy === 'hide-plot-by-default') {
      body.append(el('p', 'warning', '剧透范围：下面包含虚构样例的转折与观后解读。默认收起；未展开时，打印也保持收起。'));
      const spoiler = el('details', 'spoiler'); spoiler.append(el('summary', '', '展开剧情转折与观后想法（含剧透）'), figure, ending, comment(profile)); body.append(spoiler);
    } else body.append(figure, ending, comment(profile));
    const sources = el('div', 'sources'); const details = el('details');
    details.append(el('summary', '', '模板用途与内容归属'), el('p', '', profile.avoid), el('p', '', '当前不是自动分类器。真实输出需由字幕、画面及观看目的选主类，再按作者语气调整；所有合成示例仅用于设计展示。'));
    sources.append(details); body.append(sources); article.append(body);
    if (updateHash) history.replaceState(null, '', `#${profile.id}`);
  }
  profiles.forEach(profile => { const button = el('button', '', `${profile.symbol} ${profile.label}`); button.type = 'button'; button.dataset.id = profile.id; button.setAttribute('aria-controls', 'preview'); button.addEventListener('click', () => render(profile)); nav.append(button); });
  const fromHash = () => profiles.find(profile => profile.id === location.hash.slice(1)) || profiles[0];
  addEventListener('hashchange', () => render(fromHash(), false));
  render(fromHash(), false);
})();
