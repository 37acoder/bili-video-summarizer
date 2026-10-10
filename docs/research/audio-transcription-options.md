# 无官方字幕时的音频转录方案调研

调研日期：2026-10-10。范围：B站/YouTube 下载音频，生成带时间戳的转录，再接回现有总结流程。本文仅核验官方文档及官方源码；没有调用付费 API、下载模型或实测识别质量。文中的方案排序是针对本项目的工程判断，不代表已经完成端到端验收。

## 建议路线

采用“官方字幕优先 → 确认没有可用字幕 → 下载音频 → ASR 转录 → 统一字幕格式 → 现有总结”的回退流程是可行的。建议把下载和转录拆成两个适配器，共同产出 `start/end/text`（统一用秒）及 `source/provider/model` 元信息，让总结侧继续使用现有字幕输入。

第一版优先验证 **yt-dlp + FFmpeg + 本地 whisper.cpp**：适合当前 Mac 使用场景，能离线转录，输出时间信息，不新增按时长付费。中文应使用多语言模型，先用 small/medium 做质量和耗时比较，再决定是否需要大模型。部署到 NVIDIA Linux 时可改用 **faster-whisper**。这两项推荐依据是运行平台和接口适配，尚未用本项目中文样本证明谁更准确。接入阶段建议先放在 Agent 可选工具层：确认 `NO_TRANSCRIPT` 后显式调用研究工具，结果回送既有 prepare；调研阶段不直接改变生产 CLI 的默认行为。

国内云备选为 **百炼 Fun-ASR 录音文件识别**：中文/方言、时间戳和长音频接口较适合该链路，但需要托管音频并增加云鉴权、异步任务和费用控制。**FunASR/SenseVoiceSmall** 留作本地中文质量对比候选；不能把官方短样本速度直接套到长视频。OpenAI 可作为已有合适 API 访问条件时的备选，若保留章节时间跳转，应优先选明确提供时间戳的接口。

## 音频获取

### 共用 yt-dlp，转换交给 FFmpeg

yt-dlp 官方 README 支持选择音频格式，`-x` 进行音频提取/转换且依赖 `ffmpeg`、`ffprobe`；推荐先尝试 `-f bestaudio`，避免无意下载整段视频。仅在没有独立音轨时显式决定是否回退到整段视频再抽音频。保存源音频并按 ASR 要求转换，减少重复转码。[yt-dlp 官方 README](https://github.com/yt-dlp/yt-dlp#readme)

探索用命令示意，尚未执行：

```bash
yt-dlp --ignore-config --no-playlist -f bestaudio \
  -o 'artifacts/audio/%(id)s.%(ext)s' 'VIDEO_URL'
ffmpeg -i 'SOURCE_AUDIO' -ar 16000 -ac 1 -c:a pcm_s16le 'audio.wav'
```

`--no-playlist` 仍需结合平台分P语义选择目标。缓存身份建议含平台、视频 ID、B站 cid/分P、音轨语言及下载配置；不要只用标题。下载完成后检查时长、音轨和文件可解码性，再开始 ASR。下载媒体本身与“平台没有字幕”是两个独立问题。

### B站：可抽 DASH 音频，但鉴权和试看要区分

yt-dlp 的 B站官方 extractor 从 DASH audio 构建纯音频格式，保留 Referer，识别 `SESSDATA` 登录状态并处理 WBI 请求。源码还显式处理会员/地域限制与充电专属视频；部分结果只有试看，不能把成功下载当成获取完整视频。优先复用项目已有 B站授权，必要时将其适配到下载器；不记录 Cookie 或带签名媒体 URL。[B站 extractor 源码](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/bilibili.py)

因此建议先支持用户可完整访问的普通单P视频；真实实验中检查音频时长与页面时长一致。鉴权、验证码、平台限制或不完整试看应报独立状态，不能被包装为“无字幕”。这些是源码可见的能力和风险，本报告未验证当前账号/网络能成功下载。

### YouTube：除网络和 Cookie 外还有 JS 与 PO Token

当前 yt-dlp 官方 EJS 文档说明，YouTube 下载需要外部 JavaScript runtime 解决挑战；需要同时准备挑战脚本和受支持 runtime。安装 yt-dlp 后不能只看版本号就认为 YouTube 下载环境完整。[EJS 指南](https://github.com/yt-dlp/yt-dlp/wiki/EJS)

PO Token 的要求随客户端而异，可能影响媒体 URL 与字幕请求；缺失时可出现 403。官方当前建议使用 PO Token provider plugin，手工固定 Token 不可靠，因为部分 Token 绑定视频 ID 且有时效。[PO Token 指南](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)

需要登录的视频使用授权 Cookie，官方指出 OAuth 登录已不能用于 yt-dlp，并提示 YouTube 会轮换 Cookie。[YouTube extractor 指南](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#youtube) 普通公开视频应先试无账号路径；遇到授权/Token 问题时保留诊断，避免无界重试。增加本地音频入口可让用户在平台下载受阻时继续完成转录和总结。

## 本地 ASR 方案

| 方案 | 文档支持和配置 | 资源/成本 | 对本项目的判断与待验事项 |
|---|---|---|---|
| whisper.cpp | C/C++ CLI；Apple Silicon 支持 Metal、Accelerate、Core ML；CLI 示例输入 16-bit WAV，可导出字幕/JSON | 官方表：small 466 MiB 磁盘、约852 MB 内存；medium 1.5 GiB、约2.1 GB；large 2.9 GiB、约3.9 GB。支持量化。无云调用费 | 当前 Mac 的优先本地候选。实际峰值、速度与中文质量需测；官方内存表不是整机最低内存保证。[官方 README](https://github.com/ggml-org/whisper.cpp#readme) |
| faster-whisper | Python ≥3.9，PyAV 解码；CPU `int8`，GPU 依赖 NVIDIA CUDA 12/cuDNN 9；返回 segment 起止秒，可选 word timestamps 与 VAD | 官方 i7-12700K/8线程 small int8 基准：13分钟音频耗时1分42秒、RAM1477 MB；仅作指定硬件参考。模型首次按名称加载会下载权重 | Python 接入简洁，NVIDIA 服务端优先候选；不能据此宣称 Mac Metal 加速或本机速度。[官方 README](https://github.com/SYSTRAN/faster-whisper#readme) |
| FunASR + SenseVoiceSmall | FunASR 是工具链；SenseVoiceSmall 234M 参数，覆盖中文、粤语、英语、日语、韩语，CPU/GPU；长音频配 FSMN-VAD 分段，可加 CAM++/标点组件 | 无云调用费，但需 PyTorch/torchaudio、ASR及可选VAD等权重。未找到本机可直接套用的正式内存下限 | 中文对比候选；情感/事件标签需清理。工具链、模型、runtime 能力不能互相推定。[FunASR 官方 README](https://github.com/modelscope/FunASR#readme) |

SenseVoice 当前 README 已明确支持 `output_timestamp=True`，输出 `[start_ms,end_ms]` 与 `words` 一一对应；旧版本曾返回不同结构。使用该源码组合需当前 `model.py` 与 FunASR ≥1.4.15，单独升级包不会更新本地 remote code。直接模型推理限30秒，长录音需要分段；组合得到的说话人标签来自单独组件。不能沿用“SenseVoice 一定没有时间戳”的旧结论，也不能假设任意发行版都有同一输出契约。[SenseVoice 官方 README](https://github.com/QwenAudio/SenseVoice/blob/main/README.md)

建议固定工具/模型版本和输出样例，禁止运行时暗中下载一个不同版本模型。配置项至少包含 provider、model/path、language、device、compute type、VAD、并发和最大音频时长。第一版不需要说话人识别；先保证文本和可追溯时间戳。

## 云 ASR 方案

### OpenAI

文件转录上限25 MB，支持 mp3、mp4、mpeg、mpga、m4a、wav、webm。当前官方推荐普通文件转录 `gpt-transcribe`。`timestamp_granularities` 仅 `whisper-1`；字幕格式和细粒度时间戳不能套用到所有新模型。若需要说话人和分段起止时间，`gpt-4o-transcribe-diarize` 可返回 `diarized_json`，大于30秒需设置 chunking strategy。长文件应压缩或分块，切分避免句中断开。[文件转录指南](https://developers.openai.com/api/docs/guides/speech-to-text)

| 模型 | 官方价格/分钟 | 60分钟转录估算 | 选择理由 |
|---|---:|---:|---|
| gpt-transcribe | 估计 $0.0045 | 约$0.27 | 当前普通转录推荐；不能默认它提供章节所需时间戳 |
| gpt-4o-mini-transcribe | 估计 $0.003 | 约$0.18 | 若仅需文字可比价/比质量 |
| gpt-4o-transcribe | 估计 $0.006 | 约$0.36 | 质量对比候选，未实测 |
| whisper-1 | $0.006 | $0.36 | 明确需要词/段时间戳或SRT/VTT时更直接 |

价格依据：[当前 API 价格](https://developers.openai.com/api/docs/pricing)、[Whisper 模型价格](https://developers.openai.com/api/docs/models/whisper-1)。估算仅为转录，未含总结、重试/重叠分块和其他服务；新转录模型按对应计费项结算，官方分钟数字标为估计值时不能当作固定账单。

工程上对超过25 MB输入按静音/VAD切分，记录每块 offset，恢复全局时间戳；只返回纯文字的模型若按片段 offset 标记时间，应明确这是块级近似范围，不能伪装成句级识别时间戳。音频上传与总结 API 的凭据和访问条件分别检查，不默认现有总结服务兼容 `/audio/transcriptions`。

### 国内云：阿里云百炼 Fun-ASR 录音文件识别

`fun-asr` 非实时接口通过 HTTP 提交异步任务，支持中文及方言、热词和说话人分离；输入要求公网可访问文件URL，单次1个，最长12小时/2GB，启用说话人分离建议≤2小时。[模型与音频规格](https://help.aliyun.com/zh/model-studio/asr-model)

非实时结果固定提供时间戳，句级 `begin_time/end_time`，词级位于 `sentences[].words[]`，单位毫秒。需要提交任务、查询状态、下载结果并归一化；官方指南另说明默认敏感词过滤可能将匹配内容替换成星号，评价原始转录质量时要记录该配置。[非实时接入与时间戳](https://help.aliyun.com/zh/model-studio/non-realtime-speech-recognition-user-guide)

北京地域 `fun-asr` 为0.00022元/秒，即约0.792元/小时；官方列出10小时免费额度，适用地域和90天有效期有条件，不应写成永远免费。新加坡地域当前0.00026元/秒，不能与北京配置混用。[百炼价格](https://help.aliyun.com/zh/model-studio/model-pricing)

本地下载完后再上传临时对象存储并生成限时URL，比把平台签名URL直接交给云服务更可控。额外成本包括存储/传输和任务状态管理；URL有效期需覆盖异步识别和读取。实际 API 返回、网络可达性、质量及账单均未实测。

## 接回总结时的关键边界

以下是建议的接入要求，不是已经实现的行为：

1. 字幕结果要区分 `available`、`absent` 与 `fetch_failed`。真正不存在或明确选择转录才进入回退；登录过期、限流、格式解析故障先保留真实原因。
2. 有效音频下载后才启动转录，校验时长，防止试看或错误声轨被当作全片。无语音返回明确状态，不让空字幕进入总结。
3. 转录产出原始JSON、统一segments、SRT及可读文本；标明“自动转录”，保存 provider、model/version、language、时长和生成时间。
4. 分块保留全局offset，重叠区域去重。VAD跳过静音时必须沿用原始媒体时间轴；不能把删除静音后的累计时长用作章节链接。
5. 音频与转录分阶段缓存，转录缓存键增加模型和参数；更换总结提示词不用重新下载和转录。临时失败只重试失败阶段。
6. 展示下载、转换、转录、总结阶段，以及取消、时长限制和资源/费用预算。云模式需由明确配置启用，默认本地路径不自动切换到计费服务。

中文质量风险需要实测：人名/产品名、英文缩写、数字和否定词、方言、背景音乐、多人重叠，以及静音段误生成文字。建议用视频标题/描述中的术语作为识别提示，保留原始结果；总结不应替用户掩盖转录不确定性。

## 低成本验证计划与完成标准

优先做集成实验，不按函数数量扩张单元测试：

| 场景 | 核验内容 | 完成证据 |
|---|---|---|
| B站普通无字幕中文视频 | 无字幕判定→完整音频→转录→章节总结 | URL/视频ID、音频时长、转录文件、带时间戳总结；人工抽查前中后各约1分钟 |
| YouTube无字幕视频 | 下载环境/JS/Token或授权问题→音频→同一ASR流程 | 成功链路或真实下载阻塞；不得以下载器文档支持替代成功证据 |
| 已有官方字幕视频 | 回归：继续优先使用官方字幕 | 不触发下载/ASR、不新增转录费用 |
| 无语音、长静音与下载失败 | 空结果不总结；失败分类；断点恢复 | 状态/错误/缓存记录；失败时没有伪造字幕 |
| 同音频对比两个本地模型 | 中文术语/数字正确性、时间戳、耗时、峰值内存 | 固定样本和参数，人工核对；不引用供应商基准声称本机性能 |

本报告完成的是可行方案和接口约束的文档核验。本轮独立实验脚本位于 [explore-audio-transcription.py](../../scripts/explore-audio-transcription.py)，运行环境、真实视频音频下载及转录证据单独记录在 [实验报告](../validation/audio-transcription/REPORT.md)。该B站37分钟样本已完成本地转录、现有CLI分块与Agent总结；本文其他供应商能力、资源表和价格仍不等于本机实测。中文准确率、其他模型质量、更多平台样本的成功率，以及云API实际表现仍需后续验证。
