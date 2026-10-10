# 八类中长内容模板

用浏览器打开[index.html](index.html)，比较八类主模板的样式、行文与评论卡。无需服务器、网络或模型API。所有预览为**合成内容**，标题、录音时间与发言均为设计示例；图片明确是占位。科技类另有[真实视频样例](../summary.html)。

| 主类 | HTML骨架 | Markdown写作模板 |
|---|---|---|
| 科技数码 | [tech.html](templates/tech.html) | [tech.md](templates/tech.md) |
| 课程讲座 | [lecture.html](templates/lecture.html) | [lecture.md](templates/lecture.md) |
| 访谈播客 | [interview.html](templates/interview.html) | [interview.md](templates/interview.md) |
| 录音实录 | [recording.html](templates/recording.html) | [recording.md](templates/recording.md) |
| 严肃科普 | [science.html](templates/science.html) | [science.md](templates/science.md) |
| 知识评论 | [analysis.html](templates/analysis.html) | [analysis.md](templates/analysis.md) |
| 纪录纪实 | [documentary.html](templates/documentary.html) | [documentary.md](templates/documentary.md) |
| 影视剧情 | [drama.html](templates/drama.html) | [drama.md](templates/drama.md) |

娱乐综艺移出主目录。生活体验保留为扩展：[HTML](templates/life.html)、[Markdown](templates/life.md)，适合有路线、步骤和经验价值的长内容，不进入主预览切换。

**录音是媒介，讲座和访谈是内容结构。** 课程录音仍用讲座结构，纯音频播客仍用访谈结构。录音实录适合会议、现场讲话、口述记录等回查用途；该骨架不包含图片，用可靠时间与说话者标记组织内容。无有效画面的讲座/访谈也应删除图片，换为知识/议题/回听索引。目前这个选择由编辑完成，尚无自动媒介检测或生产渲染器。

[分类与写作规则](../../../docs/design/video-category-templates.md)说明混合内容、作者语气、评论尺度和剧透。[profiles.json](profiles.json)是事实源：八类主配置与生活扩展；base.css提供共同结构、时间线和对照卡，themes.css提供不同视觉主题。

从任意目录运行：

```sh
node /Users/polozhong/repos/video-summarizer/examples/illustrated-summary/categories/build-templates.mjs
```

这会重建八类主模板和一类扩展，共9组HTML/Markdown骨架及gallery-data.js。骨架含占位符，不是已填充总结。正式填充需核对证据、转义内容、校验链接/图片路径，删除无依据的组件与评论。实录只列明确提及的决定、负责人和日期；缺失时标未明确，不编造。

原标题逐字保留，栏目名在标题外；无标题本地录音采用用户给的名称或文件名。AI新增观点统一用紫色虚线卡及文字标签分开，打印仍保留归属。

HTML影视模板默认收起转折、截图和观后评论。Markdown无可靠折叠：完整稿先提示剧透范围，无剧透稿需删除转折、结果及对应截图与评论；原标题含剧透仍保留并提醒。

[新版集成检查](../../../docs/validation/visual-summary/categories/revision-v2.md)覆盖八类切换、窄屏、录音无图、归属、剧透和打印。[最初六类记录](../../../docs/validation/visual-summary/categories/REPORT.md)仅作历史记录。
