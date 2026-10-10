# 安装与环境

## 使用发布包

需要 Node.js >=22（推荐当前受支持的 LTS），仅文字字幕流程无需 Python、FFmpeg、ASR 模型或 LLM API key。默认图文文章的视觉能力只在图文分支按 references/illustrated-summary.md 检查。无平台字幕时按 [本地转录](local-transcription.md) 按需检查环境，不在首次使用时安装。获取完整 `skills/video-summarizer` 目录，复制整个目录，包括 scripts、references、assets、agents、LICENSE、NOTICE 和第三方声明。assets/article包含按需加载的模板与本地样式，缺少它会使图文分支不可用。这个命令行文件已经打包 npm 依赖；复制技能后不需 `npm install`。

本机共享安装目录使用 `~/.agents/skills/video-summarizer`，供 Codex/OpenCode 发现；复制整个技能目录，避免只安装到 Codex 专用目录。新开会话后，通过宿主的 skill 工具按名称加载 `video-summarizer`，确认加载位置来自 `.agents/skills`。传入 SKILL.md 的绝对路径只能验证文件可读及执行，不能代替技能发现测试。其他 Agent 使用其支持的 skill 目录。

```sh
# macOS（已装 Homebrew）：若本机缺 Node.js
brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"
# Linux/Windows：使用 Node.js 官方安装程序或已配置的版本管理器安装 22+
node --version
node '/absolute/skill/scripts/video-source.cjs' --help
```

## 从仓库构建

来源：https://github.com/37acoder/bili-video-summarizer

```sh
git clone https://github.com/37acoder/bili-video-summarizer.git
cd bili-video-summarizer
npm ci
npm run typecheck
npm test
npm run build:skill
# 生成字幕CLI与assets/article，保留独立的prepare-article.mjs
```

源码是 TypeScript；开发依赖由 package-lock.json 固定。打包脚本把字幕获取器与登录/分块 CLI 一并编译为 CommonJS，运行不依赖原仓库路径。原有库的 `npm run build` 和 LLM API 模式可独立使用，技能默认不走这条路径。分发衍生包时保留 GPL-3.0 LICENSE、NOTICE 和第三方声明，源码在上述仓库的 src/agent 与 scripts/build-skill.mjs。

## 输入与失败处理

- B站：完整 `https://www.bilibili.com/video/BV…/?p=2`、BV/av 号；可用 `--page 2`。短链接需要先通过浏览器解析为完整链接。指定不存在的分P会报错。
- YouTube：watch、youtu.be、shorts URL 或 11 位 ID；依赖第三方 savesubs。服务拒绝或缺字幕时如实返回失败，可用用户提供的字幕继续。
- `.txt`：每行一段字幕，可带 `[12.34]`、`[01:23]`、`[01:02:03]` 或 `12.34 -`。无时间戳文本也可处理，最终省略时间戳。SRT/VTT 需先规范成这种逐行文本，当前 CLI 不直接解析其格式。
- `.json`：仓库 `fetchTranscript()` 的结果：`title, source, videoId, usedDescription, transcriptText, subtitlesArray`；每个字幕项为 `{index, text, s?, e?}`，`s` 是起始秒数。`usedDescription:true` 不会被总结。
- HTTP/API 错误和风控不是“无字幕”的证据，不应伪造总结或不断重试。平台 API 请求有 20 秒超时；B站字幕校验最多尝试 8 次。
- 输出目录已存在时选择新的目录，避免混合旧结果。若准备中断，保留失败记录，在新目录重跑。

## 图文资产的维护

编辑模板的事实源为仓库 examples/illustrated-summary/categories/profiles.json、base.css、themes.css及build-templates.mjs。npm run build:skill 自动生成并打包九组模板和分开的单类写作配置；不要手工维护技能中的生成副本。生成流程去掉合成demo正文，技能只携带写作合同和占位骨架。图文流程由宿主Agent执行取材、实际读图和填充；prepare/inspect仍负责文字素材，prepare-article仅展开所选骨架，不自动总结或证明已完成视觉理解。
