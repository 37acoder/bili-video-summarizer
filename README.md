# Video Summarizer

把 B站、YouTube 视频的字幕与有信息的原帧整理成**有来源和时间戳的图文文章**，默认交付HTML与Markdown，可选仅文字总结。

本项目以 `video-summarizer` Agent Skill 的形式使用，适合 Codex、OpenCode 等支持技能和本地命令执行的 Agent。脚本负责获取、整理字幕，Agent 负责理解和总结，**无需额外配置 LLM API Key**，仍会使用你所选 Agent 的模型额度。

> 官方字幕优先；明确没有可用平台字幕时，Skill 可下载纯音轨并在本机用 whisper.cpp 转录，再继续分块总结。环境齐全自动继续，缺依赖时先披露安装内容，由用户选择安装。默认图文模式由Agent按需取得同版视频、抽帧并实际看图，选用不同内容模板；仅文字模式跳过视觉取材。

## 默认图文与按需披露

直接请求“总结这个视频”会走图文文章流程；“仅文字/不要图片”走文字章节总结，不加载视觉流程、分类配置或HTML样式。只指定Markdown仍可包含原帧。图文默认HTML阅读版加Markdown，用户指定格式时遵从。

图文过程是文字分块理解→按主题与时间筛选原帧→实际读图→联合写作→本地阅读验收。标题逐字保留原标题，新增AI评论单独标记；没有画面的讲座/播客用提纲、观点对照和回听索引。视频下载或读图能力不可用时明确降级，不把仅字幕依据写成已观看全片。

[技能入口](skills/video-summarizer/SKILL.md)只路由模式；[图文流程](skills/video-summarizer/references/illustrated-summary.md)在图文分支加载；[八类入口](skills/video-summarizer/references/article-profiles.md)进一步指向本次所选配置。模板打包在技能assets内，无需依赖源码仓库。当前由宿主Agent执行，不是自动视觉模型流水线。

## 能做什么

- **总结在线视频**：支持 B站视频及指定分P；YouTube 字幕通过第三方 savesubs 服务获取。
- **无字幕本地转录**：共用 yt-dlp → FFmpeg → whisper.cpp，默认 small 多语言模型、自动检测语言，保留 JSON/SRT 和起止时间。
- **总结本地文稿**：支持逐行 `.txt` 和项目规定格式的 `.json` 转录文件。
- **登录 B站**：支持命令行生成二维码、导入 Cookie，以及具备 Cookie 导出能力的浏览器辅助登录。
- **处理长字幕**：先分块，再逐段总结、合并；支持宿主允许的 subagent 并行处理，也支持单 Agent 顺序处理。
- **输出 Markdown**：默认生成 `summary.md`，保留来源和有依据的时间戳，并说明不确定内容或缺失范围。

## 安装

### 1. 准备环境

需要：

- **Node.js 22 或更高版本**，可从 [Node.js 官网](https://nodejs.org/) 安装。
- 支持加载 Skill、读写本地文件和执行命令的 Agent，例如 Codex 或 OpenCode。
- 获取在线视频字幕时需要网络；处理已提供的本地转录时，字幕准备步骤不需要访问视频网站。

检查 Node.js 版本：

```sh
node --version
```

技能目录已附带打包好的脚本和依赖，**使用时不需要运行 `npm install` 或构建项目**，仅文字字幕流程不需要 Python、FFmpeg 或语音识别模型；默认图文模式按需检查视频取材能力。只有确认无平台字幕后，才检查本地转录环境并按需安装。

### 2. 安装技能

以下命令适用于 macOS / Linux，需已安装 Git：

```sh
git clone https://github.com/37acoder/bili-video-summarizer.git
cd bili-video-summarizer

mkdir -p "$HOME/.agents/skills/video-summarizer"
cp -R skills/video-summarizer/. "$HOME/.agents/skills/video-summarizer/"

node "$HOME/.agents/skills/video-summarizer/scripts/video-source.cjs" --help
```

也可以通过 GitHub 的 **Code → Download ZIP** 下载，将完整的 `skills/video-summarizer` 文件夹复制到 `~/.agents/skills/`。Windows 用户可复制到用户主目录下的 `.agents/skills/`，并在终端用对应路径运行 Node.js。

安装后的入口应为：

```text
~/.agents/skills/video-summarizer/SKILL.md
```

请复制整个目录，保留 `scripts`、`references`、`assets`、`agents` 和许可证文件。安装完成后新开 Agent 会话，让它按名称加载 `video-summarizer`，确认发现的路径位于 `.agents/skills`。其他 Agent 请使用其支持的技能安装目录。

## 开始使用

直接向 Agent 提出需求即可，不需要自己操作下面的命令行步骤。

**总结 B站视频：**

```text
使用 video-summarizer 总结这个视频：https://www.bilibili.com/video/BV1KLhi6oEh5/
用中文生成图文文章，保留原标题和时间戳，新增评论单独标记，保存HTML和Markdown。
如果需要登录，请生成二维码让我扫码。
```

**总结指定分P：**

```text
使用 video-summarizer 总结这个 B站链接的第 2 P：<视频链接>
重点整理操作步骤和注意事项。
```

**总结本地长文稿：**

```text
使用 video-summarizer 总结 /绝对路径/transcript.txt。
请先分块处理，不要一次读取全文；保留重要数字、条件和前后更正，输出中文学习笔记。
```

YouTube 视频同样可以直接提供链接。你也可以指定输出语言、篇幅或关注点，例如“只关注产品对比”“整理成复习提纲”。

需要仅文字时明确说“仅文字总结，不要图片”。这一分支的输出结构如下；没有原始时间戳时省略章节时间：

```markdown
# 视频标题
来源：视频链接或转录文件
依据：字幕文本；覆盖范围及转录质量说明

## 一句话总结
主题和关键结论

## 章节要点
### [mm:ss] 章节标题
- 具体要点、论据和例子

## 关键结论
- 有依据的结论或行动项

## 不确定与缺口
仅在存在不确定转录或内容缺失时列出
```

## B站登录

首次使用或登录过期时，推荐让 Agent 生成二维码。也可以自行通过终端完成登录，凭据默认保存在 `~/.config/video-summarizer/bilibili.json`，后续使用会复用。

### 方式一：二维码登录

```sh
SKILL_DIR="$HOME/.agents/skills/video-summarizer"
LOGIN_DIR="$(mktemp -d)/bilibili-login"

node "$SKILL_DIR/scripts/video-source.cjs" auth login --out "$LOGIN_DIR"
```

打开命令输出的 `qrFile`（即 `$LOGIN_DIR/login.png`），用 B站手机客户端扫码并确认。Agent 也可以将这张本地二维码展示给你。随后运行：

```sh
node "$SKILL_DIR/scripts/video-source.cjs" auth poll --state "$LOGIN_DIR/login.json" --wait
node "$SKILL_DIR/scripts/video-source.cjs" auth status
```

`--wait` 最多等待约 180 秒。返回 `authenticated: true` 表示验证成功并已保存凭据；二维码过期时，重新生成一份即可。上述变量和命令请在同一个终端中运行。

### 方式二：导入已有 Cookie

需要的是 B站 Cookie 中的 **`SESSDATA`**，不是 `bili_jct` 或 `DedeUserID`。

1. 在浏览器中登录 B站。
2. 打开开发者工具，在 **Application / 应用程序** 或 **Storage / 存储** 中查看 `https://www.bilibili.com` 的 Cookies。
3. 将 `SESSDATA` 的原始 Value 保存到一个私有本地文件，不要再次 URL 解码。
4. 导入并验证：

```sh
SKILL_DIR="$HOME/.agents/skills/video-summarizer"
chmod 600 /绝对路径/private-cookie.txt
node "$SKILL_DIR/scripts/video-source.cjs" auth import --file /绝对路径/private-cookie.txt
node "$SKILL_DIR/scripts/video-source.cjs" auth status
```

也支持完整 Cookie 请求头、浏览器导出的 Cookie JSON 和 Netscape `cookies.txt`。不要将 Cookie 粘贴到聊天、提交到 Git，或直接放进命令行参数中。

已有环境变量 `BILIBILI_SESSION_TOKEN` 时，脚本优先使用其中的**单个 SESSDATA 值**；其次是 `--auth-file` 指定的文件，最后是默认凭据文件。若导入后仍显示旧登录失效，检查并清除过期的环境变量。

有浏览器能力的 Agent 可以打开 B站让你登录；自动获取登录状态还需要浏览器工具支持 Cookie 或 storage state 导出。仅能打开网页并不代表能读取 HttpOnly Cookie。详见 [B站登录说明](skills/video-summarizer/references/bilibili-auth.md)。

## 支持哪些输入

| 输入 | 用法与限制 |
| --- | --- |
| B站 | 完整视频 URL、BV 号或 av 号；通过 URL 的 `?p=2` 或 `--page 2` 指定分P。短链接需先解析为完整链接。 |
| YouTube | watch、youtu.be、shorts 链接或 11 位视频 ID；依赖 savesubs 服务，可能需要 `SAVESUBS_X_AUTH_TOKEN`。 |
| `.txt` | 每行一段，可使用 `[12.34]`、`[01:23]`、`[01:02:03]` 或 `12.34 -` 时间标记，也支持无时间戳文本。 |
| `.json` | 项目的 `TranscriptResult` 格式，并非任意 JSON；具体字段见 [输入格式说明](skills/video-summarizer/references/setup.md#输入与失败处理)。 |
| SRT / VTT | 当前不能直接解析，请先转换成上述逐行文本格式。 |

## 可选：自己用命令行准备字幕

如果希望先获取字幕，再交给 Agent 总结，可以直接调用附带脚本：

```sh
SKILL_DIR="$HOME/.agents/skills/video-summarizer"
JOB_DIR="$(mktemp -d)/video-summary"

node "$SKILL_DIR/scripts/video-source.cjs" prepare \
  --video 'https://www.bilibili.com/video/BV1KLhi6oEh5/' \
  --out "$JOB_DIR"

node "$SKILL_DIR/scripts/video-source.cjs" inspect \
  --manifest "$JOB_DIR/manifest.json"
```

处理本地转录时，将 `prepare` 命令替换为：

```sh
node "$SKILL_DIR/scripts/video-source.cjs" prepare \
  --transcript '/绝对路径/transcript.txt' \
  --title '视频标题' \
  --out "$JOB_DIR"
```

每次 `prepare` 的输出目录必须尚不存在、父目录已存在。不要对同一个 `$JOB_DIR` 重复运行；再次运行前重新设置该变量。

输出包含完整转录 `transcript.json`、分块目录 `chunks/` 和清单 `manifest.json`。**CLI 只准备素材，不生成最终总结。** 将清单的绝对路径交给 Agent，并让它使用 `video-summarizer` 完成后续总结即可。

## 常见问题

**还需要保留克隆的仓库吗？**

安装完成后，运行只依赖完整技能目录和 Node.js，无需保留外部源码或 `node_modules`。登录凭据和任务输出另行保存。仓库中的源码用于维护和更新打包脚本；更新技能时，获取新版本并重新复制完整技能目录。

**为什么登录成功仍然没有总结？**

登录不保证视频有可访问的字幕。`NO_TRANSCRIPT` 且 `reason=captions_absent` 表示当前平台提取器明确没有可用字幕，Skill 会进入下文的本地转录流程。短字幕仍可能报 `NO_TRANSCRIPT`，但不会触发转录。也可以提供自己的转录文件继续。HTTP 412、网络错误和平台风控需要分别处理，不能当作“无字幕”，也不应不断重试。

**长视频会不会超出 Agent 的上下文？**

技能会先分块，再逐段总结和分层合并。有 subagent 时可在宿主允许的范围内分派处理；没有时会顺序处理并记录进度。实际容量仍受 Agent 限制，需要时应压缩上下文或在新会话续跑；未完成的部分会标明，不会当作完整结果交付。详见 [长字幕总结流程](skills/video-summarizer/references/summarization.md)。

**YouTube 提取失败怎么办？**

当前通过第三方 savesubs 获取字幕，受服务可用性、鉴权和字幕权限影响。可以改为提供本地字幕或转录文本。

**Agent 找不到技能怎么办？**

确认文件位于 `~/.agents/skills/video-summarizer/SKILL.md`，而不是多嵌套了一层目录；安装后新开会话，再让 Agent 按名称加载。其他宿主需检查其技能发现目录。命令行 `--help` 成功只说明脚本可运行，不代表 Agent 已发现技能。

## 无字幕：本地转录与按需安装

首次使用仅检查 Node 和脚本，仍先走字幕流程。确认无可用平台字幕后，Skill 说明将下载音频并在本机识别，然后运行 `asr doctor`。工具和模型齐全就继续；缺项才展示缺失工具、模型大小、安装位置和方式，由用户选择安装或提供文稿/结束。

```sh
node "$SKILL_DIR/scripts/video-source.cjs" asr doctor
# 了解安装内容并选择安装后，显式执行；prepare 和库 API 不会安装
node "$SKILL_DIR/scripts/video-source.cjs" asr setup
node "$SKILL_DIR/scripts/video-source.cjs" prepare \
  --video 'https://www.bilibili.com/video/BV12ftJ6rEkw/' \
  --asr local --out '/absolute/new-job-directory'
```

macOS 使用已有 Homebrew，只补齐缺失的 `yt-dlp`、`ffmpeg`（含 ffprobe）、`whisper.cpp`。没有 Homebrew 时提供手动准备步骤，不自动安装包管理器。默认模型 `ggml-small.bin` 约 **466 MiB**，从 whisper.cpp 官方指向的模型库下载，校验固定 SHA-256 后原子保存。Linux/Windows 可配置已有工具，第一版未实测；详见 [本地转录流程](skills/video-summarizer/references/local-transcription.md) 和 [按需安装](skills/video-summarizer/references/asr-installation.md)。

配置保存于 `~/.config/video-summarizer/asr.json`，模型和阶段缓存保存于 `~/.cache/video-summarizer/`。可用 `--model-path` 复用多语言 GGML 模型、`--asr-language zh` 覆盖识别语言，也可显式 `--model medium`；不自动升级模型。`--yt-dlp`、`--ffmpeg`、`--ffprobe`、`--whisper-cli` 可指定工具路径，`--asr-config` 与 `--asr-cache-dir` 可指定配置和缓存位置；doctor/setup/prepare 使用同样选项。

音轨缓存区分平台、视频和分P；转录缓存区分音频内容、模型内容和语言。B站复用已有授权，通过私有临时 Cookie 文件传给下载器并清理；不记录凭据或签名 URL。进度写入 stderr，Ctrl-C 可取消，失败不会写成功清单，重跑会复用有效阶段；最终输出目录仍禁止覆盖。输出额外含原始 ASR JSON/SRT/TXT，字幕项保留 `s` 和 `e`，清单记录引擎、模型、语言、时长与来源。

平台返回 CAPTIONS_INVALID 时可显式 --caption-retries 3，在同一前台进程最多重试三次；HTTP、鉴权、解析和取消不重试，也不将异常当作无字幕。输出目录已有内容时保留并换新目录。章节按最早要点定位，转录纠错的语境猜测必须标为未核实。

总结后执行 `verify-summary --manifest <manifest.json> --summary <summary.md> --chapters <chapters.json>`，校验原标题、章节引文、起点与正文 item 引用，以及待核对的确定纠错措辞。返回 valid=true 后仍须有界核对语义支持，程序校验不证明转录准确。

CLI 只准备素材；总结仍按现有分块流程由 Agent 生成，标明本地自动转录及疑点。HTTP、鉴权、解析和字幕身份校验失败不会触发 ASR；空识别结果不会生成成功任务。B站的字幕接口可能返回与目标不符的字幕，应修复或稍后重试，不能强行当作无字幕。YouTube 空列表仅表明 savesubs 当前未提供可用字幕。

## 可选：豆包云端转录

无平台字幕时，用户可选择豆包作为另一种转录方案。开通火山引擎**流式语音识别2.0**，将语音 API KEY 存入本机私有的 `~/.config/video-summarizer/doubao.json`（`{"api_key":"实际密钥"}`，权限0600），即可让 Agent 使用豆包转录并继续总结。配置 key 本身不会触发上传，已有平台字幕与本地转录流程仍可使用。

技能自带 `scripts/doubao-transcribe.py`，提供 `doctor/download/prepare/inspect`。除文字外，完整保存句/词时间戳、说话人、情绪、声音性别估计、语速、音量和语种，并按文本分块提供附加信息；情绪和身份相关字段只作为模型估计的辅助依据。成功结果按音频和参数缓存，失败会话不会自动重复上传。

环境、命令、信息使用和恢复规则见 [豆包独立说明](skills/video-summarizer/references/doubao-transcription.md)，验证见 [技能接入验收](docs/validation/doubao-skill-integration.md)。这是技能的可选流式入口，库 API 与录音文件 AUC 批处理尚未接入豆包。

## 可选：库 API

库的普通字幕路径保持不变。Node 环境中，传入 `localTranscription` 即启用同一回退流程，实例的 `fetchTranscript`、`buildPrompt`、`summarize` 和 `summarizeStream` 共用它；库自身不执行安装：

```ts
import { createVideoSummarizer } from 'bili-video-summarizer'

const summarizer = createVideoSummarizer({
  subtitle: { bilibiliSessionTokens: [process.env.BILIBILI_SESSION_TOKEN!] },
  localTranscription: { // {} 使用保存的配置，缺省为 small / auto
    modelPath: '/absolute/existing/ggml-small.bin',
    language: 'auto',
    // cacheDir, configFile, tools: { ytDlp, ffmpeg, ffprobe, whisperCli }
    onProgress: event => console.log(event),
  },
  llm: { apiKey: process.env.OPENAI_COMPATIBLE_API_KEY },
})
const input = {
  video: { source: 'bilibili' as const, videoId: 'BV12ftJ6rEkw', pageNumber: 1 },
  options: { showTimestamp: true },
}
const transcript = await summarizer.fetchTranscript(input)
const prompt = await summarizer.buildPrompt({ ...input, transcript })
// summarize / summarizeStream 使用自有 LLM；Skill 模式由 Agent 总结，无需此 API。
```

可选配置还支持 AbortSignal 和工具路径。ASR 摘要使用独立缓存标识及转录内容指纹，避免旧缺字幕结果遮蔽新转录；模型、语言或内容变化会隔离结果。显式传入 `transcript` 会跳过字幕提取与 ASR。原始平台 `fetchTranscript` 导出仍只提取字幕；自动回退通过配置后的实例使用。

## 保留的调研与实验


无官方字幕时，可以先下载纯音频，在本地转录，再将结果送入已有的字幕分块和 Agent 总结流程。此前独立 Python 实验使用 **yt-dlp + FFmpeg + whisper.cpp**，现已迁入 TypeScript 共用实现；实验脚本保留用于研究复现。新 small 实现的耗时、文本完整性与识别疑点见 [实现验收报告](docs/validation/audio-transcription/LOCAL-ASR-IMPLEMENTATION.md)。方案、云端费用和平台限制见 [调研报告](docs/research/audio-transcription-options.md)，真实视频的运行证据见 [验证报告](docs/validation/audio-transcription/REPORT.md)。

实验需另行准备 Python 3、yt-dlp、ffmpeg/ffprobe、whisper-cli，以及 whisper.cpp 支持的多语言 GGML 模型；脚本不会安装工具或下载模型。

```sh
python3 scripts/explore-audio-transcription.py \
  --video 'https://www.bilibili.com/video/BV12ftJ6rEkw/' \
  --model '/absolute/path/ggml-medium.bin' \
  --out '/absolute/new-job-directory'
```

输出目录必须尚不存在、父目录已存在。结果包含原始音频、16kHz 单声道 WAV、自动转录 JSON/TXT/SRT、项目格式的 `transcript.json` 和 `prepared/manifest.json`。脚本在完成后打印各阶段耗时；**后续总结仍由 Agent 读取清单与分块完成**。本地 ASR 不产生转录 API 费用，Agent 总结仍使用宿主模型额度。现有 B站字幕登录文件不会自动传给下载器；下载需登录时，可使用 `--cookies` 指定私有 Netscape Cookie 文件。

自动转录会有术语、专名、数字识别错误；总结需标明来源为自动转录及不确定内容。实验完成不代表 YouTube、所有视频或全部识别质量已经验证。

## 许可证与致谢

本项目源自 [BibiGPT-v1](https://github.com/JimmyLv/BibiGPT)，采用 **GPL-3.0-only** 许可证。来源与版权声明见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)，打包依赖的声明见 [THIRD-PARTY-NOTICES.txt](skills/video-summarizer/scripts/THIRD-PARTY-NOTICES.txt)。
