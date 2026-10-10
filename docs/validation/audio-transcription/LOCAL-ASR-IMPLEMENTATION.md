# 本地转录实现与验收

本次实现覆盖 CLI、库实例与 Skill，共用 TypeScript 的 yt-dlp → FFmpeg → whisper.cpp 回退。原研究脚本、medium 实验报告和视觉研究文件保留；本报告的 small 数据来自新的真实运行，不沿用 medium 的耗时或质量结论。

## 实现

- 平台字幕结果增加 `captionStatus=available|absent|unusable`。只有明确空列表才回退；HTTP、鉴权、解析、字幕身份校验失败及短字幕不会启动 ASR。B站回退前验证登录，并全程使用同一 SESSDATA。
- CLI 的 `asr doctor` 只检查，`asr setup` 显式补缺项，`prepare --asr local` 不安装。库实例的 `localTranscription` 配置覆盖 fetchTranscript、buildPrompt、summarize 和 summarizeStream；提供 transcript 时跳过提取。原始顶层 fetchTranscript 仍只提取平台字幕。
- small 多语言为缺省模型，语言 auto；支持已有模型、工具路径、语言、配置及缓存目录覆盖。macOS 使用已有 Homebrew，正式包名 whisper.cpp，不自动安装包管理器。下载按固定大小和 SHA-256 校验后原子保存；配置权限 0600。
- 音频按平台/视频/分P隔离；识别按音频 SHA、模型 SHA、语言隔离。阶段有进度、取消、并发锁和重试恢复；成功清单最后写入，失败阶段不标成功。私有临时 Cookie 和转换 WAV 在完成/失败后清理。摘要使用独立缓存空间及内容指纹。
- 最终目录禁止覆盖，含原始 ASR JSON/SRT/TXT；每段保存 s/e，清单记录识别来源。Skill 首次仅检查 Node/脚本，无字幕后才读本地转录文档，缺项后才读安装文档并让用户选择。总结明确标注自动转录来源及疑点。

## 真实 small 验证

目标：[BV12ftJ6rEkw，P1](https://www.bilibili.com/video/BV12ftJ6rEkw/?p=1)。本机 Apple M4 / 16 GiB，Node 22.22.2、yt-dlp 2026.08.19、FFmpeg 9.0.2、whisper.cpp 1.9.5。模型 ggml-small.bin，487,601,967 字节，SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`；模型通过新 setup 的真实网络下载与校验，已有工具全部复用。

```sh
node skills/video-summarizer/scripts/video-source.cjs prepare \
  --video BV12ftJ6rEkw --asr local \
  --out review/asr-small-integration --chunk-tokens 3000
```

| 指标 | 新 small 运行结果 |
| --- | --- |
| 页面 / 纯音轨时长 | 2222 / 2221.312 秒 |
| 音频下载 | 1.939 秒 |
| 转换 16kHz 单声道 PCM | 1.180 秒 |
| small 识别（auto → zh） | 158.595 秒，约 2 分 39 秒 |
| 字幕段 / 分块 | 772 段 / 11 块，预算 3000 估算 token |
| 文本完整性 | 所有分块按顺序拼接，与全部字幕文本逐字符一致 |
| 时间戳与预算 | s/e 全部保留，11 个文件均在预算内 |
| 最后识别的语音 | 2207.56–2208.16 秒，“拜拜” |
| 尾部未识别范围 | 约 13.152 秒，未据此断言是静音或遗漏 |
| 重跑 | download-audio 与 transcribe 均返回 cached，仍输出 11 块 |

原始产物在本机忽略目录 `review/asr-small-integration/`：transcript.json、asr/whisper.json/.srt/.txt、manifest.json、verification.json、library-verification.json、live-library-verification.json。`review/asr-small-cache-replay/` 为真实缓存复用输出。小体积可核验指标见 [small-result.json](small-result.json)。没有把媒体、凭据或模型提交到仓库。

首、中、尾抽样发现明确识别疑点，原文保留，下面是语境推测而非人工校听结论：

| 时间 | small 原文 | 需核对内容 |
| --- | --- | --- |
| 00:00 | “欢迎回到东脱邦” | 节目/频道专名不稳定，不据此确认名称 |
| 00:02.68 | “科技起点” | 语境可能指“科技奇点” |
| 00:08.24 | “一口重生的说” | 可能是“一口同声地说” |
| 19:54.16 | “养寵家庭” | 中英文及简繁识别混杂，保留上下文 |
| 19:57.96 | “pat.com” | 该段宠物电商例子的名称需核对，不能凭 ASR 确认 |
| 36:36.12 | “亲立文明变迁” | 可能是“亲历文明变迁” |
| 36:37.64 | “地球的主任” | 语境可能是“地球的主人” |

这不是逐字准确率评测，也未逐段听取全片。自动字幕能完整进入分块流程不意味着识别内容正确。

B站接口在本次验证中有两类真实响应：明确空列表，以及返回时长不匹配的其他字幕。后者报 CAPTIONS_INVALID 并停止，未强行回退。随后明确空列表时，新 CLI 成功走完整下载与 small 识别。构建后的 ESM 库也在明确缺失时成功 fetchTranscript，复用真实缓存，返回 772 段并生成标注自动来源的 buildPrompt。

另用真实 small 转录验证 gpt-3.5-turbo 的分块与合并传输：3 个 map prompt + 2 个 reduce 调用，首尾均进入 prompt，全部调用附自动来源说明。**LLM 使用模拟客户端，输出是测试占位文本，不能作为真实模型总结质量验收。** 本次不调用付费云端转录或额外 LLM API；此前 medium 的 Agent 总结继续单独保留。

## 主要集成流程

`test/local-transcription.test.ts` 使用实际子进程运行隔离的工具协议替身，平台请求使用 fixture；不是所有工具或平台的真实联网测试。

| 流程 | 观察结果 / 验证边界 |
| --- | --- |
| 有字幕 / 短字幕，无 ASR 环境 | 即使 ASR 配置损坏也不读取，不运行下载/安装；短字幕不触发转录 |
| 明确无字幕，工具模型齐全 | P2 URL 与 Cookie 传递、JSON/SRT/s/e、完整分块、库总结和流式总结共用回退 |
| 依赖缺失与拒绝安装 | doctor 报具体缺项；fallback 报 ASR_DEPENDENCIES_MISSING；不调用 setup 时无安装/媒体结果 |
| 选择安装并继续 | 隔离 Homebrew 替身只收到 install yt-dlp，已有 FFmpeg/whisper/model 不安装；继续同一视频 |
| 无 Homebrew | setup 报 ASR_SETUP_UNSUPPORTED，没有安装包管理器或工具 |
| 模型安装 | 真实 small 下载校验成功；模拟不完整下载无法成为可用模型，part 清理；损坏已有模型拒绝使用 |
| 请求/身份错误 | HTTP 403、无效登录、缺字段、时长错配均不触发 ASR |
| 下载失败、空识别、取消 | 无成功阶段清单/最终任务；Cookie、临时 WAV 和进程锁清理；重跑复用已完成音轨 |
| 缓存隔离与手动输入 | 修改识别语言或同一路径模型内容会重新识别但复用音频；旧无字幕摘要不遮蔽新结果；提供 transcript 跳过提取 |
| 复制后的完整 Skill | 仓库外运行，环境中无 API key、无本地 node_modules；缺字幕分支 → doctor/setup → prepare 继续；字幕成功时不检查 ASR |

渐进式行为通过以上真实 CLI 分支输出及 SKILL/reference 阅读顺序检查；安装/拒绝是测试选择，未把静态文档校验当作自由 Agent 实际对话评测。自发现仍需新开宿主会话；已有技能目录更新不会刷新当前会话已经加载的描述。

## 构建检查与平台范围

通过：类型检查、85 个测试（11 文件，其中新增 6 个主要集成过程）、ESM/CJS/类型声明构建、Skill 打包、skill-creator quick_validate、git diff --check。打包构建检查入口与所有引用文档存在，复制后的运行不依赖原仓库或 npm 安装。

真实端到端验证限于 macOS、此 B站视频 P1 与默认 small。指定 P2、缺工具 Homebrew 安装、故障恢复、库的 LLM/流式传输使用隔离集成测试。Linux/Windows 手动工具配置、YouTube 真实音频下载、全部转录质量未实测。
