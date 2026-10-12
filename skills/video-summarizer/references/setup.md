# 安装与环境

## 使用发布包

需要Node.js >=22（推荐当前受支持的LTS）。技能运行脚本统一使用JavaScript，统一入口是scripts/video.mjs，所需npm依赖已打包。仅文字字幕流程无需Python、FFmpeg、ASR模型或LLM API key；视觉能力在图文分支按references/illustrated-summary.md检查。无平台字幕时，按所选 [本地转录](local-transcription.md) 或 [豆包转录](doubao-transcription.md) 检查环境并按需安装；豆包还需私有API key及已开通的对应语音服务。

复制完整 `skills/video-summarizer` 目录，包括scripts、references、assets、agents、LICENSE、NOTICE和第三方声明。assets/article提供按需加载的模板和本地样式，缺少它会使图文分支不可用。命令行文件已打包npm依赖，复制技能后无需 `npm install`。

本机共享安装目录使用 `~/.agents/skills/video-summarizer`，供 Codex/OpenCode 发现；复制整个技能目录，避免只安装到 Codex 专用目录。新开会话后，通过宿主的 skill 工具按名称加载 `video-summarizer`，确认加载位置来自 `.agents/skills`。传入 SKILL.md 的绝对路径只能验证文件可读及执行，不能代替技能发现测试。其他 Agent 使用其支持的 skill 目录。

```sh
# macOS（已装 Homebrew）：若本机缺 Node.js
brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"
# Linux/Windows：使用 Node.js 官方安装程序或已配置的版本管理器安装 22+
node --version
node '/absolute/skill/scripts/video.mjs' env
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
# 打包JavaScript客户端和依赖，生成assets/article与assets/editorial
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

模板以仓库examples/illustrated-summary/categories/profiles.json、base.css、themes.css及build-templates.mjs为源。修改源文件后运行npm run build:skill，生成并打包九组模板；同一分类源还生成assets/editorial/profiles内的轻量行文配置，两种模式各读所选类别。生成副本由构建维护。

打包时去掉合成demo正文，技能只携带行文配置与占位骨架。宿主Agent负责取材、实际读图和填充；prepare/inspect处理文字素材，prepare-article只展开所选骨架，其成功不代表文章写完或完成了视觉理解。
