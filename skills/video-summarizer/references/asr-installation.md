# 本地转录的按需安装

仅在无可用平台字幕、doctor 显示缺项后读取。先展示 doctor 的 `missingTools`、`model.status/path`、配置和缓存位置，再让用户选择。`installation.toolPackages` 仅列缺失工具包，`homebrewPrefix` 给出本机 Homebrew 安装根目录；仅在模型缺失（`modelDownloadBytes>0`）时披露模型下载，已有可用模型只说明复用。示例披露按实际缺项缩减：

> 缺少：<实际工具列表或模型>。将复用已有工具，仅补齐缺项。macOS 工具由现有 Homebrew 安装到其管理目录；small 多语言模型约 466 MiB（487,601,967 字节），从 whisper.cpp 官方脚本指向的 Hugging Face 模型库下载，校验 SHA-256 后保存到 <doctor 的模型路径>。配置保存到 <configFile>，音频及转录缓存保存到 <cacheDir>；处理这个视频还需相应缓存空间。是否安装并继续，或提供转录文件/结束？

用户选择安装后，运行与 doctor 同样配置的命令：

```sh
node "$SKILL_DIR/scripts/video-source.cjs" asr setup
node "$SKILL_DIR/scripts/video-source.cjs" asr doctor
```

setup 只补缺项，不执行升级。工具从 PATH 或显式路径发现；FFmpeg 与 ffprobe 属于同一个包。macOS 缺工具时使用已有 Homebrew，按需运行 `brew install yt-dlp ffmpeg whisper.cpp` 的缺项子集。正式包名为 `whisper.cpp`，不是旧的 `whisper-cpp`。没有 Homebrew 时脚本停止并给出手动准备提示，不能自动安装包管理器；用户可自行按 [Homebrew 官方说明](https://brew.sh/) 准备，或给已有工具的路径。

模型下载与工具安装独立。默认 small，不自动升级 medium；已有多语言 GGML 模型可通过 `--model-path` 使用。默认 small/medium 文件名会校验官方固定大小与 SHA-256；自定义文件名检查多语言 GGML 头并由引擎验证可加载性。临时 `.part` 下载不是可用模型，失败会清理；成功后原子保存。损坏现有模型不会被悄悄覆盖。

默认持久化位置：

- 配置：`~/.config/video-summarizer/asr.json`（0600）。
- 模型：`~/.cache/video-summarizer/models/ggml-small.bin`。
- 阶段缓存：`~/.cache/video-summarizer/audio/` 与 `transcripts/`。

拒绝安装：不运行 setup，不下载模型；可用 `prepare --transcript` 继续，也可正常结束并说明没有生成视频总结。

Linux / Windows 第一版支持已有工具的手动配置，未做真实端到端验证。按各工具官方说明准备 yt-dlp、FFmpeg/ffprobe、whisper-cli 和多语言 GGML 模型，确认可执行后运行：

```sh
node "$SKILL_DIR/scripts/video-source.cjs" asr doctor \
  --yt-dlp '/absolute/yt-dlp' --ffmpeg '/absolute/ffmpeg' \
  --ffprobe '/absolute/ffprobe' --whisper-cli '/absolute/whisper-cli' \
  --model-path '/absolute/model.bin'
```

同样选项传给 prepare；ready 后可显式 setup 仅保存配置。Windows 用本机路径及终端语法，工具可为 `.exe`。脚本不要求 Python 转录脚本，但手动安装的 yt-dlp 分发方式可能自行依赖 Python。

来源：[Homebrew whisper.cpp](https://formulae.brew.sh/formula/whisper.cpp)、[whisper.cpp 官方模型下载脚本](https://github.com/ggml-org/whisper.cpp/blob/master/models/download-ggml-model.sh)、[官方指向的模型库](https://huggingface.co/ggerganov/whisper.cpp)、[yt-dlp 安装说明](https://github.com/yt-dlp/yt-dlp#installation)、[FFmpeg 下载](https://ffmpeg.org/download.html)。
