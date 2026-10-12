# README 展示截图

这些 PNG 由 Chromium 实际渲染仓库中的 HTML 后截取，使用本地样式与系统字体，不依赖外部图片服务。

- `summary.png`：真实科技视频的[图文成品](../../../examples/illustrated-summary/summary.html)，1200 × 2000，截取文章开头至首张原帧与图注。
- `commentary.png`：同一成品的首个 AI 评论卡，1200 × 300；保留非原片观点的归属标识。
- 八张分类截图：来自[模板预览页](../../../examples/illustrated-summary/categories/index.html)，每张 1024 × 1400，截取各类文章开头。内容为合成示例，图片区域为占位；录音实录不配图，影视剧透默认收起。

模板骨架位于 `skills/video-summarizer/assets/article/templates/`；分类截图展示填充示例后的视觉效果，不能当作真实视频总结。

## 重新生成

本机已安装 `agent-browser` 及其 Chromium 时，从仓库根目录运行：

```sh
node scripts/capture-readme-previews.mjs
```

脚本使用独立浏览器会话，检查原帧加载、分类切换、横向溢出、录音无图与剧透折叠，完成后关闭会话。截图只隐藏滚动条，不改变正文或模板排版。重新生成会覆盖本目录同名 PNG；字体差异可能改变换行，需复核截图。

GitHub README 会[过滤网页样式和脚本](https://github.com/github/markup)，因此使用仓库内的相对图片链接展示效果。README 中的 HTML 链接用于查看和下载源码；完整排版需克隆或下载仓库后在浏览器打开，保留相邻 CSS、JS 和素材目录。
