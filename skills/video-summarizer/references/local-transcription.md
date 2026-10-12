# 无平台字幕时的本地转录

只在 prepare 的 JSON 错误是 `NO_TRANSCRIPT` 且 `reason=captions_absent` 后读取此文档。平台拒绝、登录失败、解析失败、身份/时长不匹配的字幕和短字幕不能作为无字幕证据。YouTube 的空列表来自 savesubs，表示当前提取服务没有可用字幕，不证明 YouTube 本身没有字幕。

先简短说明：“未找到可用平台字幕，将下载这个分P的纯音频，用本机 whisper.cpp 识别后继续总结。自动转录可能有专名、术语和数字错误。”随后检查环境，尚不安装：

```sh
node "/absolute/skill/scripts/video.mjs" asr doctor
```

`ready=true`：自动继续，无需再次选择安装。`ready=false`：此时才读取 [按需安装](asr-installation.md)，向用户展示实际缺项及安装内容，让用户选择安装、提供转录文件或结束。已有本次安装授权时不重复询问。模型损坏不是缺失，先说明检查结果和修复路径，不能覆盖现有模型。

环境就绪后重跑原视频任务，保留原URL、分P、认证文件和块预算，加上 `--asr local`。输出目录按执行与恢复规则选择，已有失败目录时使用新目录：

```sh
node "/absolute/skill/scripts/video.mjs" prepare \
  --video '原视频完整URL' --asr local --out '/absolute/new-job-directory'
```

prepare 仍会先尝试平台字幕，只有明确缺失才转录。默认 small 多语言模型、自动检测语言；用户指定时才用 `--asr-language zh` 或 `--model-path '/absolute/existing/model.bin'`。可用 `--model small|medium` 显式切换模型，不自动升级 medium。doctor、setup 和 prepare 必须使用一致的配置选项。完整选项见脚本 `--help`。

处理流程为 yt-dlp bestaudio → FFmpeg 16kHz 单声道 PCM → whisper.cpp → 现有分块。B站通过权限为 0600 的临时 Cookie 文件复用已验证的 SESSDATA，阶段结束或失败清理；不展示 Cookie、下载器日志或签名 URL。仅下载选定分P的音轨，不下载视频画面。

进度是 stderr 的阶段 JSON，stdout 仍仅打印清单路径和块数。可发送 Ctrl-C / SIGINT 取消。有效音轨按平台、视频和分P缓存；有效转录按音轨内容、模型内容、语言缓存。失败不写阶段成功清单，重跑可复用已完成阶段。最终任务目录不允许覆盖，若已有失败目录，选择新目录；不要清空全局缓存来重试。

成功目录额外包含 `asr/whisper.json`、`.srt`、`.txt`；转录 JSON 中每段保留 `s` 起始秒数与 `e` 结束秒数。清单记录引擎、模型、请求/识别语言、音频时长和来源。不要一次读完整原始转录；回到 SKILL.md 的 inspect 与分块流程。最终总结明确标注本地自动转录来源，记录有时间点的识别疑点。

转录命令与失败恢复按 [前台执行与重试](execution.md) 处理。全部进程完成且 inspect 成功后才进入总结。

常见失败：

| 结果 | 下一步 |
| --- | --- |
| ASR_DEPENDENCIES_MISSING | doctor 后按需披露安装内容，等待用户选择 |
| ASR_MODEL_INVALID | 损坏模型不能使用；换已有模型路径，或经用户选择移走损坏文件后 setup |
| ASR_SETUP_UNSUPPORTED | 手动准备 Homebrew/工具，不自动安装包管理器 |
| ASR_TOOL_FAILED / ASR_INVALID_AUDIO | 检查登录、工具路径、视频可下载性；不猜测内容，不显示可能含凭据的原始日志 |
| ASR_INVALID_TRANSCRIPT | 空或异常识别没有成功结果；用户可重试、明确切换模型/语言或提供文稿 |
| ASR_CANCELLED / ASR_TIMEOUT | 保留有效阶段缓存，使用新任务目录重跑 |
| ASR_BUSY | 同一阶段仍在运行；完成后重试，失效进程锁在重跑时恢复 |
