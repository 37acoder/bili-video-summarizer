# TEST-REPORT — video-summarizer 真实用户任务（文字模式）

- 日期：2026-10-11
- 工作目录：`<project>`（`pwd` 已核验）
- 视频：`https://www.bilibili.com/video/BV12ftJ6rEkw/?p=1`（BV12ftJ6rEkw，第 1 分P）
- 模式：**仅文字**（用户明确“不要图片”）；未生成图片/HTML
- 结果：**succeeded**（产物见文末）；初稿曾未通过独立验收，已按 revision-2 Skill 的 `verify-summary` 修订至 `valid=true`，详见文末“第二轮修订”。

## 阶段顺序与实测

| # | 阶段 | 命令（要点） | 安全/简短输出 | 耗时 |
|---|------|--------------|----------------|------|
| 0 | 环境检查 | `node --version`；`video-source.cjs --help`；`which yt-dlp ffmpeg whisper-cli`；`ls ~/.cache/video-summarizer/models` | `v22.22.2`；工具与 `ggml-small.bin` 均存在 | <5s |
| 1 | 登录检查 | `video-source.cjs auth status` | `{"authenticated":true}` | ~1s |
| 2 | 输出保护检测 | 对已存在的 `output-protected/` 执行 `prepare --video … --out output-protected` | `{"error":"OUTPUT_EXISTS: choose a new output directory"}`；sentinel 未变 | 1s |
| 3 | 平台字幕 prepare | `prepare --video '…BV12ftJ6rEkw/?p=1' --out output --caption-retries 3` | `{"error":"NO_TRANSCRIPT","reason":"captions_absent"}`；未创建 output | <1s |
| 4 | ASR 环境检查 | `asr doctor --model small --model-path …/ggml-small.bin --asr-language auto --asr-cache-dir stage-cache --asr-config isolated-asr.json` | `{"ready":true,…}` 工具/模型齐全 | 3s |
| 5 | 无字幕转录 prepare | `prepare --video … --asr local --model small --model-path … --asr-language auto --asr-cache-dir … --asr-config … --caption-retries 3 --out output` | `download-audio: cached`；`transcribe: cached`；`chunkCount:11`，`usedDescription:false` | 1s |
| 6 | 清单检查 | `inspect --manifest output/manifest.json --offset 0 --limit 20` | 单页，`nextOffset:null`，11 块，772 items，`detectedLanguage:zh`，`audioDurationSeconds:2221.312` | <1s |
| 7 | 分块理解 | 逐块读 `chunks/NNNN.json` → 写 `maps/NNNN.md`（11 块） | 11/11 map 一一对应 | Agent 侧 |
| 8 | Reduce | 按 ≤4 块一组写 `reduce/level-1-group-{1,2,3}.md` | 3 组，覆盖 0001–0011 | Agent 侧 |
| 9 | 章节校验 | `node evidence/validate-chapters.cjs output` | 12 章 `ok=12 bad=0`；逐章有界读 ≤3 items | <1s |
| 10 | 写作与交付 | 写 `output/summary.md`、`output/chapters.json`、`result.json`、`TEST-REPORT.md` | — | Agent 侧 |

总耗时约 6–7 分钟（含 Agent 阅读与写作），在 30 分钟截止内。

## 渐进式披露/读取行为

- 通过宿主 `skill` 工具加载 `video-summarizer`；返回的共享技能内容与本目录复制的 `SKILL.md` 一致，脚本使用本目录复制版。
- 读取顺序：`SKILL.md` → `references/bilibili-auth.md`、`references/execution.md`（步骤 3 前）→ `references/local-transcription.md`（仅 `NO_TRANSCRIPT`+`captions_absent` 后）→ `references/summarization.md`（分块前）→ `references/text-summary.md`（仅写作时）。
- 未加载图文相关资源（`illustrated-summary.md`、视觉证据、模板），符合“仅文字”分支。
- 未一次性读取 `transcript.json`；用 `inspect` 取得清单后逐块读取。

## 缓存与转录是否真正执行

- **阶段缓存非空**：`stage-cache/` 中已有 `audio/bilibili/BV12ftJ6rEkw-p1` 音轨与 `transcripts/<hash>/` 下的 whisper 产物。prepare 报告 `download-audio: cached` 与 `transcribe: cached`。
- **转录是否为本次执行**：**否**。CLI 校验并复用了继承的有效缓存，本次运行未重新下载音轨、未重新运行 whisper.cpp，因此**本次未实测 ASR 墙钟耗时**。
- `isolated-asr.json` 不存在（符合预期），CLI 自行校验后使用；未运行 `asr setup`。

## 成功与失败边界

- 成功：登录有效；`OUTPUT_EXISTS` 保护按预期拒绝覆盖且未发起网络/ASR；平台字幕确认为 `captions_absent`（非拒绝/鉴权/解析错误）；`doctor ready=true`；prepare 产出可用的 11 块清单；`inspect` 单页成功；11 map 与清单一一对应；12 章逐章校验通过。
- 未发生：未将 HTTP/鉴权/解析错误伪装成无字幕；未强制误用 ASR；未安装工具；未修改凭据。
- 边界说明：平台字幕缺失属真实结果；ASR 复用缓存，非模拟平台/ASR/LLM。

## 产物路径

- `output/summary.md`（章节要点、关键结论、覆盖与疑点）
- `output/chapters.json`（12 章：heading / sourceItemIndex / sourceStartSeconds / sourceQuote）
- `output/maps/0001.md … 0011.md`；`output/reduce/level-1-group-{1,2,3}.md`
- `output/manifest.json`、`output/transcript.json`、`output/asr/whisper.{json,srt,txt}`（CLI 产物）
- 证据：`evidence/01-auth-status.txt` … `evidence/10-wording-scan.txt`、`evidence/validate-chapters.cjs`
- 保留：`output-protected/sentinel.txt`（`1264bdfe…`，未变）
- 测试报告：`TEST-REPORT.md`、`result.json`

## 其他

- 未 `git commit/push`，未修改源码/全局配置，未调用额外 LLM/云 ASR API，所有写入均在 `project` 内。
- 本总结依据本地自动转录，专名/术语/数字疑点均标“可能，未核实”，未读音频、未看画面。

## 第二轮修订（独立验收后，revision-2 Skill）

独立验收使用新打包 CLI 的 `verify-summary` 对本轮产物校验，初稿 **未通过**（`valid=false`）。以下如实记录初稿错误与修订过程，未隐去。

### 独立验收发现（初稿，round 1）

```
{"valid":false,"chapterCount":12,"problems":[
 {"chapter":2,"reason":"CHAPTER_START_AFTER_CITED_CONTENT"},
 {"chapter":4,"reason":"CHAPTER_SOURCE_MISMATCH"},
 {"chapter":5,"reason":"CHAPTER_START_AFTER_CITED_CONTENT"},
 {"chapter":6,"reason":"CHAPTER_START_AFTER_CITED_CONTENT"},
 {"chapter":8,"reason":"CHAPTER_START_AFTER_CITED_CONTENT"},
 {"chapter":11,"reason":"CHAPTER_START_AFTER_CITED_CONTENT"}
]}
```

原因（对应新规则“校验会拒绝晚于正文已引用 item 的章起点”）：

| 章 | 问题 | 细节 |
|----|------|------|
| 2 | 章起点晚于已引用内容 | 起点 item 33，正文却引用了 item 17–25（高智凯首次预警，属上一章 0–32 区块） |
| 4 | 来源不匹配 | 标题时间写作 `[05:31]`，而 floor(330.68)=`05:30`，与 sourceStartSeconds 不符 |
| 5 | 章起点晚于已引用内容 | 起点 item 151，正文引用 item 146–159（过渡句 146–150 早于起点） |
| 6 | 章起点晚于已引用内容 | 起点 item 226，正文引用 item 217–225（e/.com 命名融资早于起点） |
| 8 | 章起点晚于已引用内容 | 起点 item 343，正文引用 item 336–352（泡沫顶峰数据早于起点） |
| 11 | 章起点晚于已引用内容 | 起点 item 626，正文引用 item 609–621（高盛 5.3 万亿估算早于起点） |

### 修订内容

1. **Ch1/Ch2**：把高智凯首次预警（item 17–25）并入 Ch1（其 0–32 区块），Ch2 删除重复要点；Ch2 起点 item 33 = 章内最早引用。
2. **Ch4**：标题时间 `[05:31]` → `[05:30]`（= floor(330.68)）。
3. **Ch5**：首条引用由 item 146–159 收窄为 151–159（起点行本身）。
4. **Ch6**：起点前移至 item 217（717.24s → `[11:57]`），要点按时间重排，标题改为“泡沫狂欢：‘e/.com’命名融资、纸上百万富翁与全民入场”。
5. **Ch8**：起点前移至 item 336（1062.4s → `[17:42]`），标题改为“泡沫从顶峰到破裂：一地鸡毛与中国互联网寒冬”。
6. **Ch10/Ch11**：把高盛 5.3 万亿估算（item 609–621）由 Ch11 移入 Ch10；Ch11 起点 item 626 = 章内最早引用。
7. **Ch12**：要点按时间重排（669–704 / 705–726 / 727–753 / 754–769）。

同步更新 `chapters.json`：Ch6 → item 217 / 717.24s / “现在我们都知道股神是巴菲特的外号”；Ch8 → item 336 / 1062.4s / “互联网泡沫始于1995年8月”。引文均为对应 item 的连续原文，未改字、未补标点。

### 复核结果

- `verify-summary`（round 2）：`{"valid":true,"chapterCount":12,"problems":[],"limitation":"..."}`。
- 逐章有界核对（程序读取，≤3 items/章 + 人工判读）：12/12 通过，各章起点处引文均支持该章标题与首条要点（如 Ch2 #33“在网上吹哨…专家不胜枚举”“敢于给出…具体时间表”“高智凯算是其中之一”；Ch11 #626“在不少业内人士看来”“最核心的一个区别”“在于参与企业的盈利能力”）。
- 章起点秒数严格递增：0, 115.68, 188.6, 330.68, 485.96, 717.24, 887.08, 1062.4, 1301.8, 1526, 1842.76, 1955.28。
- map/reduce 复核：`maps/0001..0011` 与清单 11/11 对应，引文与疑点来自各自 chunk，未因章节修订而失真；reduce 三组覆盖 0001–0011；确定纠错措辞扫描 0 命中（`应为/正确是` 已清除）。

### 修订约束遵守

未重新下载/转录，未创建后台/子任务，未调用其他模型，未删除目录，仅修改本 project 下当前任务的 `output/summary.md`、`output/chapters.json`、`result.json`、`TEST-REPORT.md` 与 `evidence/` 记录。
