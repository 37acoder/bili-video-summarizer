# 无官方字幕音频转录实验

日期：2026-10-10。源码基线：`d005ce0`。本次为研究实验，新增独立脚本和文档；现有字幕获取器、已打包 Skill 和默认行为未改动。

## 验证目标与环境

- 测试视频：[BV12ftJ6rEkw](https://www.bilibili.com/video/BV12ftJ6rEkw/)，第1P，标题为《2026像极了千禧年灾难前的1998！2027大崩盘真的要来了吗？能让你保命的一期！深度推演AI泡沫破裂时间线》。B站页面接口时长2222秒；音轨2221.312秒，差异不到1秒。
- 机器：Apple M4、arm64、16 GiB内存。`yt-dlp 2026.08.19`、`whisper.cpp 1.9.5`；FFmpeg/ffprobe、Node、Python均为已有工具。
- 模型：已有 `ggml-medium.bin` 多语言模型；日志显示使用Metal GPU，4线程、beam size/best-of均为默认5，指定中文，无VAD及术语提示。没有下载新模型或调用转录API。
- 输出目录：仓库下 `review/audio-asr/BV12ftJ6rEkw/`，已由既有 `.gitignore` 排除；音频、完整转录与运行日志仅在本地保留。

## 官方字幕基线

现有CLI `auth status` 返回 `authenticated: true`；`prepare --video` 退出码1，错误为 `NO_TRANSCRIPT: captions absent or too thin; provide a transcript, not a description`。

另经项目现有鉴权/请求工具读取B站页面与播放器接口，`viewCode=0`、`playerCode=0`，第1P的`cid=41516207106`，字幕列表长度0。匿名yt-dlp探测同样返回 `subtitles=[]` 和 `automatic_captions=[]`。这是本次请求的实际状态，不承诺平台日后不会补字幕。

干净的字幕探测结果保存在本地 `caption-status.json`，不含Cookie、用户身份或签名URL。

## 实验流程与复现

```mermaid
flowchart LR
    A[无可用官方字幕] --> B[yt-dlp 下载纯音频]
    B --> C[FFmpeg 16kHz 单声道 WAV]
    C --> D[whisper.cpp 中文转录]
    D --> E[TranscriptResult JSON]
    E --> F[现有 prepare 分块]
    F --> G[Agent 逐块总结]
```

从仓库根目录运行，须先创建输出父目录，目标目录不能已存在：

```sh
mkdir -p review/audio-asr
python3 scripts/explore-audio-transcription.py \
  --video 'https://www.bilibili.com/video/BV12ftJ6rEkw/' \
  --model '/Users/polozhong/.cache/hyperframes/whisper/models/ggml-medium.bin' \
  --out '/Users/polozhong/repos/video-summarizer/review/audio-asr/BV12ftJ6rEkw-new'
```

模型路径为本机现有缓存路径，其他机器需要替换。脚本严格选择 `bestaudio`，本次为M4A，不下载完整视频；无独立音轨时直接报告下载失败。下载不需要登录，因此本次没有导出或传递现有Cookie。原始下载元数据含签名URL，读取必要字段后即删除，仅保存视频ID、标题、时长等。

`whisper.json`/`.srt`/`.txt`保留原始转录；`transcript.json`增加引擎/模型/语言来源，转换毫秒起始时间为秒并校验时序和边界。该JSON由原有CLI作为本地转录读入，生成`prepared/manifest.json`和分块，不需要修改业务代码。当前manifest的`provenance.kind`仍是`provided-transcript`，ASR来源附在转录JSON内；正式接入应把ASR来源直接写进清单。

## 结果

本次样本已跑通“无官方字幕 → 完整音轨下载 → 本地ASR → 现有prepare分块 → Agent总结”。[样例总结](summary.md)已生成。

| 阶段 | 实测结果 |
|---|---|
| 纯音频下载 | 4.304秒，M4A 39,439,205字节 |
| 音频标准化 | 1.353秒，16kHz单声道16-bit PCM WAV |
| Whisper medium转录 | 563.503秒，约9分24秒；音频长37分1.312秒，RTF约0.254，即约3.94倍实时速度 |
| 现有CLI prepare | 0.074秒，882个片段、9块，预算3000估算token/块 |
| Agent总结 | 9/9分段笔记齐全，合并成带来源、章节时间及疑点的总结；未独立测量这一步耗时 |

前三阶段加prepare共约569.234秒（9分29秒），不含额外探测、云输入转码、检查和Agent总结。进程运行中曾观察RSS约2 GiB，但没有全程峰值测量，不能当作内存上限。上述速度仅适用于本次机器、模型参数和音频。

自动校验结果：所有分块文件SHA-256与manifest一致；每块不超预算；拼接各块的字幕项，与输入转录的文字、顺序、时间戳完全相等；882个时间戳按顺序排列，`timestamped=true`、`usedDescription=false`。分段笔记覆盖`0001..0009`和index `0..881`，没有遗漏分块。

识别文字首句从0秒开始，最后一句“我们下期节目再见了 拜拜”在2206.6–2208.6秒（约36:46.6–36:48.6）；原音轨末尾约13秒没有识别文字，没有听校它是否为静音/音效或漏识别。这项检查证明ASR输入全长及输出可处理，不证明逐字准确率。

本地证据：`video.json`、`caption-status.json`、`metrics.json`、`verification.json`、`transcript.json`、`whisper.json`/`.srt`/`.txt`、`prepared/manifest.json`、9个`chunks`与9个`maps`。为方便复核，干净的指标和校验快照另保存在[结果快照](result.json)；完整音频与转录仍在忽略目录。

## 云端输入的额外实验

原始M4A为39,439,205字节（约37.61 MiB），16kHz WAV为71,082,062字节（约67.79 MiB）。两者都超过[OpenAI文件转录25 MB限制](https://developers.openai.com/api/docs/guides/speech-to-text)。使用如下命令生成48 kbps、16kHz单声道MP3：

```sh
ffmpeg -nostdin -i audio.m4a -vn -ar 16000 -ac 1 -b:a 48k cloud-input-48k.mp3
```

ffprobe测得MP3为13,328,915字节（约12.71 MiB），时长仍为2221.312秒，因此可以满足文件大小限制；压缩后识别质量及API接受情况没有验证。另一选择是按静音分块并加回全局时间偏移。

仅以本次时长计算，按[whisper-1每分钟0.006美元](https://developers.openai.com/api/docs/models/whisper-1)约为0.222美元；按[百炼北京Fun-ASR每秒0.00022元](https://help.aliyun.com/zh/model-studio/model-pricing)约为0.489元，未含总结、重试、存储和传输费用。没有实际提交云任务或产生转录API账单。

## 回归与失败边界检查

- `npm run typecheck`通过；既有`npm test`的10个测试文件、79个测试全部通过。未为简单包装函数扩张单元测试。
- Python脚本AST语法检查通过；已实际验证再次指定已有输出目录时退出码1、`FileExistsError`，不覆盖正在运行的结果。
- 已实际验证不支持的URL在创建目录、下载或加载模型之前被拒绝（退出码1、`ValueError`）。

## 边界与后续接入

这是一个B站中文长视频样本的可行性实验。YouTube、付费/试看、多P、无语音、平台风控、云API、其他ASR模型均未实测。官方方案对比、价格和配置见[调研报告](../../research/audio-transcription-options.md)。

本次转录有“科技起点”（语境疑似“科技奇点”）、“网警”（语境疑似“网景”）等术语疑点，以及将未来投资截止年份识别为“2023年”的上下文冲突；本次不具备逐字人工听校和人工标准字幕，不能给出准确率、WER或声称字幕精确。样例总结保留了这些疑点，以及作者在后半段对前半段崩盘叙事的限定。语音覆盖不等于画面理解，时间戳合法也不能证明每句听写正确。

正式接入建议增加显式本地ASR选项，保留官方字幕优先；将真正无字幕与登录失效、风控/HTTP错误、字幕异常分开。复用现有B站凭据但不放进命令行或日志，增加模型检查、下载/转录分阶段缓存、失败恢复、取消及最长时长限制。云方案另行配置，不自动由本地失败切到付费调用。
