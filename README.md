# Video Summarizer

把 B站、YouTube 视频的字幕或本地转录文本整理成**带来源、章节要点和时间戳的中文总结**。

本项目以 `video-summarizer` Agent Skill 的形式使用，适合 Codex、OpenCode 等支持技能和本地命令执行的 Agent。脚本负责获取、整理字幕，Agent 负责理解和总结，**无需额外配置 LLM API Key**，仍会使用你所选 Agent 的模型额度。

> 当前只分析字幕，不识别视频画面，也不提供音频转录、截图或关键帧提取。没有可用字幕时会说明原因，不会仅凭标题和简介生成视频总结。

## 能做什么

- **总结在线视频**：支持 B站视频及指定分P；YouTube 字幕通过第三方 savesubs 服务获取。
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

技能目录已附带打包好的脚本和依赖，**使用时不需要运行 `npm install` 或构建项目**，也不需要 Python、ffmpeg 或语音识别模型。

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

请复制整个目录，保留 `scripts`、`references` 和许可证文件。安装完成后新开 Agent 会话，让它按名称加载 `video-summarizer`，确认发现的路径位于 `.agents/skills`。其他 Agent 请使用其支持的技能安装目录。

## 开始使用

直接向 Agent 提出需求即可，不需要自己操作下面的命令行步骤。

**总结 B站视频：**

```text
使用 video-summarizer 总结这个视频：https://www.bilibili.com/video/BV1KLhi6oEh5/
用中文输出章节要点和关键结论，保留时间戳，保存为 summary.md。
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

默认输出结构如下；没有原始时间戳时，会省略章节时间：

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

登录不保证视频有可访问的字幕。`NO_TRANSCRIPT` 表示缺少可用字幕或文本不足；可以提供自己的转录文件继续。HTTP 412、网络错误和平台风控需要分别处理，不能当作“无字幕”，也不应不断重试。

**长视频会不会超出 Agent 的上下文？**

技能会先分块，再逐段总结和分层合并。有 subagent 时可在宿主允许的范围内分派处理；没有时会顺序处理并记录进度。实际容量仍受 Agent 限制，需要时应压缩上下文或在新会话续跑；未完成的部分会标明，不会当作完整结果交付。详见 [长字幕总结流程](skills/video-summarizer/references/summarization.md)。

**YouTube 提取失败怎么办？**

当前通过第三方 savesubs 获取字幕，受服务可用性、鉴权和字幕权限影响。可以改为提供本地字幕或转录文本。

**Agent 找不到技能怎么办？**

确认文件位于 `~/.agents/skills/video-summarizer/SKILL.md`，而不是多嵌套了一层目录；安装后新开会话，再让 Agent 按名称加载。其他宿主需检查其技能发现目录。命令行 `--help` 成功只说明脚本可运行，不代表 Agent 已发现技能。

## 许可证与致谢

本项目源自 [BibiGPT-v1](https://github.com/JimmyLv/BibiGPT)，采用 **GPL-3.0-only** 许可证。来源与版权声明见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)，打包依赖的声明见 [THIRD-PARTY-NOTICES.txt](skills/video-summarizer/scripts/THIRD-PARTY-NOTICES.txt)。
