# TEST-REPORT — video-summarizer 真实用户任务验收

- 任务：B站视频 `BV12ftJ6rEkw`（第 1 分P）中文章节点与关键结论，保留来源与实际时间戳，完整覆盖全片，指出识别疑点；无平台字幕时本机转录后继续。
- 工作目录（执行前 `pwd` 验证）：`/Users/polozhong/repos/video-summarizer/review/opencode-live-2026-10-11/job-eb335cb7/project`
- 使用技能：宿主 skill 工具加载 `video-summarizer`，其 Base directory 为本目录复制的 `.opencode/skills/video-summarizer`（内容与共享版一致，命令均使用本目录脚本）。
- 结论：**succeeded**。发送方无平台字幕（`captions_absent`），按技能规则进入本地转录分支，本机 whisper.cpp 真实执行，产出 `output/summary.md`。
- 计时：任务起于 2026-10-11 00:01 左右，主要命令/ASR 结束于 00:06，总结与报告完成于 00:09 内，未超 30 分钟。

## 按顺序的阶段

### 1. 环境与技能入口
- `pwd` 确认工作目录正确；读 `.opencode/skills/video-summarizer/SKILL.md`；宿主 skill 工具加载 `video-summarizer`（Base dir 即本目录复制版本）。
- 命令：`node --version` → `v22.22.2`（满足 ≥22）。
- 命令：`node "<SKILL_DIR>/scripts/video-source.cjs" --help` → 正常列出子命令。
- 证据：无独立文件（stdout 见对话）。

### 2. 登录检查
- 命令：`node … auth status` → `{"authenticated":true}`（未输出任何凭据）。
- 证据：`evidence/01-auth-status.txt`。耗时 <1s。

### 3. 先 prepare 平台字幕（渐进式披露：先字幕、后 ASR）
- 命令：`prepare --video 'https://www.bilibili.com/video/BV12ftJ6rEkw/?p=1' --out '<job>/output'`
- 首次结果：`{"error":"CAPTIONS_INVALID","message":"Platform captions are invalid; retry or provide a transcript"}`（耗时 2s）。
  - 处理：**未**把解析异常当作“无字幕”。按 CLI 提示“retry”重试（未绕平台、未强行 ASR）。
- 重试结果：`{"error":"NO_TRANSCRIPT","reason":"captions_absent"}`，此时才依技能第 3 步进入无字幕分支。
- 证据：`evidence/02-prepare-captions.txt`、`evidence/03-prepare-retry1.txt`。

### 4. 无字幕分支：披露 + doctor（未安装）
- 已向用户披露：“未找到可用平台字幕，将下载该分P纯音频，用本机 whisper.cpp 识别后继续总结；自动转录可能有专名、术语、数字错误。”
- 读 `references/local-transcription.md`（有条件读取）。
- 命令：`asr doctor --model small --model-path '<existing>/ggml-small.bin' --asr-language auto --asr-cache-dir '<job>/stage-cache' --asr-config '<job>/isolated-asr.json'`
- 结果：`ready:true`；yt-dlp/ffmpeg/ffprobe/whisper-cli 均 available；模型 status=ready、bytes=487601967、sha256=1be3a9b2…987b。**未运行 asr setup，未安装任何东西。**
- 证据：`evidence/04-asr-doctor.txt`。耗时 <1s。

### 5. prepare --asr local（真实下载 + 本机识别）
- 命令（与 doctor 一致配置，输出到新目录 `<job>/output`）：
  `prepare --video '…BV12ftJ6rEkw/?p=1' --asr local --model small --model-path '<existing>/ggml-small.bin' --asr-language auto --asr-cache-dir '<job>/stage-cache' --asr-config '<job>/isolated-asr.json' --out '<job>/output'`
- 平台字幕探测仍间歇性返回 `CAPTIONS_INVALID`：首次尝试（后台）1s 即失败并**未启动转录**；紧接着一次重试同样 1s 失败；改用有界循环重试（最多 8 次，遇到首个非暂时性结果即停）。第 1、2 次仍为 `CAPTIONS_INVALID`，第 3 次成功进入 ASR。
  - 说明：`CAPTIONS_INVALID` 为暂时性解析异常，重试是 CLI 明示路径，未将其当作无字幕、未绕过平台验证。
- 第 3 次成功阶段输出（stderr 阶段 JSON）：
  - `download-audio`：started → complete，`seconds: 2.369`
  - `normalize-audio`：started → complete，`seconds: 1.347`
  - `transcribe`：started → complete，`seconds: 154.679`
  - 循环整体耗时 `172s`。
- stdout（仅清单路径与块数）：`{"manifest":"…/output/manifest.json","chunkCount":11,"usedDescription":false}`
- 证据：`evidence/05-prepare-asr.*.txt`、`evidence/06-prepare-asr-retry1.*.txt`、`evidence/07-prepare-asr-loop.*.txt`。
- **缓存是否为空 / 是否真正执行**：`stage-cache/` 与 `isolated-asr.json` 起初均不存在；本次为新执行，`download-audio` 记录 `started`（非“复用”），音轨 `stage-cache/audio/bilibili/BV12ftJ6rEkw-p1/audio.m4a`（39,439,205 字节，mtime 00:02）与转录 `stage-cache/transcripts/<hash>/`（complete.json mtime 00:05）均为本次产物；未使用 review 中的任何旧转录/旧摘要/旧验收结论。

### 6. 分块读取方式（渐进式披露）
- 命令：`inspect --manifest '<job>/output/manifest.json'` → 返回全部 11 个块索引（`nextOffset:null`，单页）。provenance：`local-asr` / `whisper.cpp` / `ggml-small.bin` / requestedLanguage=auto / detectedLanguage=zh / audioDurationSeconds=2221.312 / itemCount=772 / chunkCount=11。
- 处理：**未**一次性读取 `transcript.json` 或拼接全部 chunks；逐块读 `chunks/NNNN.json` 并写 `maps/NNNN.md`。
- 证据：`evidence/08-inspect.txt`。

### 7. Map（逐块）
- 依次读 11 个 chunk，写出 `output/maps/0001.md`–`0011.md`（每份记录 chunk ID、item 范围、实际 s 时间、主张/数字/条件/否定与悬念）。
- 清单核对（脚本比对 manifest ID 与 map 文件名）：`{"chunkIds":11,"maps":11,"missing":[],"extra":[],"allPresent":true}`。
- 证据：`evidence/09-map-checklist.txt`。

### 8. Reduce（每组 ≤4 map）与最终稿
- 写 `output/reduce/level-1-group-A.md`（0001–0004）、`level-1-group-B.md`（0005–0008）、`level-1-group-C.md`（0009–0011），保留全部 chunk ID 与关键时间范围。
- 写 `output/summary.md`（15,001 字节），章节覆盖全片、时间戳取自实际 `s` 字段、标注本地自动转录、单列专名/数字/术语疑点。

## 命令与安全
- 所有命令均为 `node "<SKILL_DIR>/scripts/video-source.cjs" …`，`SKILL_DIR=<job>/.opencode/skills/video-summarizer`。
- 输出中**未出现任何凭据**；`auth status` 仅返回布尔；CLI 未打印 Cookie、下载器日志、签名 URL 或完整转录。
- 未改源码/全局配置，未 git commit/push，未额外云端转录，未调用额外 LLM API，宿主模型未切换；未使用 subagent/后台 Session（本文件所述“后台”仅为 shell 作业，非 OpenCode Session）。
- 写入范围仅限本 job 目录。

## 成功与失败边界
- 成功：登录有效；识别到 `captions_absent`；doctor ready；音频下载 + whisper.cpp 识别真实完成；11 块 map 全齐；summary 完整覆盖。
- 边界/不确定性：
  - 平台字幕探测存在间歇性 `CAPTIONS_INVALID`（非稳态），本次经重试后取得明确 `captions_absent` 才进入 ASR；前两次失败**未**启动转录、**未**被当作无字幕证据。
  - `isolated-asr.json` 仅作为 `--asr-config` 路径被读取，CLI 未生成该文件（不存在属正常）。
  - 本次为自动转录，专名/数字可能有误，已在 summary 的“不确定与缺口”按首/中/尾分段列出。

## 产物路径
- 最终总结：`…/job-eb335cb7/project/output/summary.md`
- 清单：`…/project/output/manifest.json`；转录：`…/project/output/transcript.json`；ASR 产物：`…/project/output/asr/whisper.{json,srt,txt}`
- 分块：`…/project/output/chunks/0001.json`–`0011.json`；块笔记：`…/project/output/maps/0001.md`–`0011.md`；归并：`…/project/output/reduce/level-1-group-{A,B,C}.md`
- 证据：`…/project/evidence/01`–`10`
- 阶段缓存（本次新建）：`…/project/stage-cache/`
- 本报告：`…/project/TEST-REPORT.md`；结果：`…/project/result.json`
