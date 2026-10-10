# 图文总结原型

这是一份**真实视频抽帧 + 宿主 Agent 读图 + 文章排版**的研究样例。没有把视觉流程接入生产 CLI/Skill，也不是自动选帧质量评测。

直接用浏览器打开 `summary.html`（保留同目录 `summary.css` 与 `assets/`），或阅读 `summary.md`。无需启动服务器、安装依赖、配置 API Key。

| 文件 | 用途 |
|---|---|
| `summary.html` | 已填充的活泼图文样例；原标题、原片叙述、独立AI评论卡，手机/桌面/打印样式 |
| `summary.md` | 与 HTML 同内容的可迁移图文文章 |
| `summary.template.html` | 可复用 HTML 骨架；占位符需替换，不是已实现的自动渲染接口 |
| `summary.template.md` | 可复用 Markdown 写作模板 |
| `summary.css` | 共用本地样式，无外部字体/CDN/脚本 |
| `assets/` | 6张原视频JPEG帧，没有生成插画或重绘 |
| `evidence.json` | 原片信息、媒体hash、请求时间/实际PTS、图像hash、附近字幕范围与可见事实 |

素材：[BV1KLhi6oEh5](https://www.bilibili.com/video/BV1KLhi6oEh5/)；文字源为[仓库已有字幕](../samples/BV1KLhi6oEh5.input.txt)。截图仅用于本地研究样例，来源保留于每条图注中。搬运到公众号等平台时仍需处理图片上传、来源和平台样式适配。

article-v2遵循三条写作规则：标题逐字保留视频原标题；正文自然延续原片的故事、例子与语气；额外观点独立标为“加餐 · AI 评论 / 非原片观点”。HTML用紫底虚线卡，Markdown用引用块，打印时仍保留归属标签。

复用时先按[方案](../../docs/design/illustrated-summary.md)准备画面与字幕证据，再按模板写作。不要把占位图、封面、AI生成图或未读取的截图标成视觉理解结果。正式渲染器需要转义文本、校验链接与图片路径；当前HTML骨架不是安全自动渲染器。

新版验证结果及截图见[改版记录](../../docs/validation/visual-summary/revision-v2.md)；素材获取与初版实验见[实验记录](../../docs/validation/visual-summary/REPORT.md)。

## 内容分类模板

已调整为[八类中长内容预览](categories/index.html)：科技数码、课程讲座、访谈播客、录音实录、严肃科普、知识评论、纪录纪实、影视剧情。娱乐综艺移出主目录，生活体验保留为扩展。每类有独立视觉主题、HTML骨架与Markdown写作合同；[分类规则](../../docs/design/video-category-templates.md)区分内容类型和输入媒介，说明评论归属与纯音频无图呈现。新类别预览为合成示例，当前真实科技样例保持原版。
