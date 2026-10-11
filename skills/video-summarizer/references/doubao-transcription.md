# 豆包转录与丰富语音信息

## 何时使用

平台字幕仍是首选。确认没有平台字幕，且用户选择豆包转录或已设定云端转录偏好时，执行本方案；用户直接提供音频并要求豆包转录时也可使用。只有 API key 存在不能视为上传音频的选择。HTTP、鉴权、解析或字幕身份错误不是“无字幕”；先处理实际错误，不切换 ASR 掩盖问题。新版字幕 CLI 用 `NO_TRANSCRIPT` 且 `reason=captions_absent` 表示明确缺字幕；旧版本只返回 `NO_TRANSCRIPT` 时须核实原因。

本入口是独立的 `scripts/doubao-transcribe.py`，与现有平台字幕、本地转录并存，不改变库 API 的 `fetchTranscript()`。一次流式会话请求最终文字、句级/词级时间戳、说话人及语音附加信息，然后转成现有 prepare/inspect/Map-Reduce 可读的任务。已选图文模式继续融合实际读取的原帧；仅文字模式继续文字写作。

## 一次配置

1. 在火山引擎同一项目开通**流式语音识别 2.0**，创建有对应权限的语音 API key。此入口资源为 `volc.seedasr.sauc.duration`，不是录音文件识别服务。仅创建 key 不代表服务已开通；服务条款、免费额度和后付费按账户的实际状态处理。脚本不会自动开通服务或创建密钥。
2. 将真实 key 存在本机私有文件 `~/.config/video-summarizer/doubao.json`，格式为 `{"api_key":"实际密钥"}`；目录权限 0700，文件权限 0600。也支持已有同格式文件，通过 `--credential-file '/absolute/private-config.json'` 指定。环境变量 `DOUBAO_ASR_API_KEY` 优先于文件。不要把 key 放进仓库、聊天、日志或命令行参数；key 的名称和界面掩码不能代替真实值。
3. Python >=3.9；未缓存的 API 调用需要 `aiohttp`、`certifi`。Node.js >=22 和技能自带的 `video-source.cjs` 用于分块。已符合 16kHz、单声道、16-bit PCM WAV 的音频不需要 FFmpeg；其他格式按需检查 FFmpeg。下载音频另需 `yt-dlp`、`ffprobe`，B站还需现有登录凭据。无需 Whisper 模型、额外 LLM key、对象存储或 SDK zip。

```sh
python3 "$SKILL_DIR/scripts/doubao-transcribe.py" doctor
# 使用已有私有配置时，doctor/prepare 都传相同的 --credential-file
```

doctor 不联网，也不验证账户开通状态。缺少 Python 依赖时可使用专用虚拟环境，之后命令改用该环境的 Python：

```sh
python3 -m venv "$HOME/.venvs/video-summarizer-doubao"
"$HOME/.venvs/video-summarizer-doubao/bin/python" -m pip install aiohttp certifi
```

依赖安装按已有授权和环境管理规则执行，首次使用平台字幕不安装这些可选依赖。

## 下载、转录、继续总结

已有可信、对应视频及分P的音频时直接复用。需要下载时：

```sh
python3 "$SKILL_DIR/scripts/doubao-transcribe.py" download \
  --video 'https://www.bilibili.com/video/BVxxxxxxxxxx/?p=2' \
  --out '/absolute/new-audio-directory'
```

支持完整 B站 BV/av URL（包含选定的 `p`）与 YouTube watch/youtu.be URL；其他形式先解析为规范链接。B站复用 `BILIBILI_SESSION_TOKEN` 或 `~/.config/video-summarizer/bilibili.json`，自定义文件用 `--auth-file`。只下载音轨，检查视频 ID、分P与时长；临时 Cookie 和包含签名 URL 的下载信息在私有临时目录中处理并清理。保留 `audio-source.json` 中的原标题、来源、ID、分P、时长与音频哈希。时长匹配仅是异常筛查，不能证明内容准确。

用下载输出中的实际路径、原标题及身份调用；标题逐字保留，不用测试标题或自行概括替换：

```sh
python3 "$SKILL_DIR/scripts/doubao-transcribe.py" prepare \
  --audio '/absolute/audio-directory/audio.m4a' \
  --source bilibili --video-id 'BVxxxxxxxxxx' --page 2 \
  --title '视频原标题' --out '/absolute/new-summary-job'
# YouTube 改为 --source youtube，传真实 11 位 ID，--page 1
node "$SKILL_DIR/scripts/video-source.cjs" inspect \
  --manifest '/absolute/new-summary-job/manifest.json'
python3 "$SKILL_DIR/scripts/doubao-transcribe.py" inspect \
  --job '/absolute/new-summary-job' --chunk 0001 --offset 0 --limit 10
```

`--out` 必须是新目录且父目录存在；默认文本块预算约 3000 token，可用 `--chunk-tokens` 调整。脚本在自己的临时文件中规范音频，保留原输入；校验终态、非空文字、确定句段及时间范围后才导出任务。只有命令成功且 `asr/complete.json` 存在才算完整的豆包任务，失败后留下的目录不作为完成结果。来源/标题由调用方传入，脚本不从 ASR 推测视频身份。短片段只总结实际覆盖区间，不能宣称覆盖整段视频；裁剪后时间戳从片段起点计时，映射原视频须记录并加回实际裁剪偏移。

首次 API 请求上传音频至火山引擎。端点为 `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async`，鉴权头为 `X-Api-Key`、`X-Api-Resource-Id`、`X-Api-Request-Id`。固定 200ms 实时发送，开启 `enable_nonstream` 内部二遍识别；默认语言自动识别，可按需指定 `--language zh-CN`。这不是整文件高速批处理：180秒试验会话约182秒。长视频可另行评估录音文件识别 AUC；其开通、音频 URL 和请求接口不同，当前 helper 未实现。helper 自设单次音频上限5小时，不代表供应商所有接口的时长上限。

## 信息如何保存与使用

| 信息 | 请求参数 | 保存与使用 |
| --- | --- | --- |
| 完整文字、句/词时间戳 | `show_utterances=true`、`result_type=full` | 原始响应保留所有词；文本块供理解；句段时间供引用与定位 |
| 说话人 | `enable_speaker_info=true` | `additions.speaker_id`；帮助区分发言轮次、引述与观点归属 |
| 情绪与程度 | `enable_emotion_detection=true` | `emotion`、`emotion_degree` 及 score；只能作为模型估计的辅助线索 |
| 声音性别估计 | `enable_gender_detection=true` | `gender`、`gender_score`；用于识别质检，不据此推断身份 |
| 语速、音量 | `show_speech_rate=true`、`show_volume=true` | `speech_rate`、`volume`；可标记需要回听的变化，不能单独解释情绪 |
| 语种 | `enable_lid=true` | `lid_lang`、`lid_lang_score`；辅助发现混语或需复核片段 |

同时开启标点和 ITN，关闭 DDC，不主动删除口语；一些附加能力会触发 VAD 句段切分。服务可能省略不支持或无法识别的字段；**缺失就写未知**。能力是否实际返回依赖音频和当前服务，不能保证每段都有所有字段。

文件分工：

- `transcript.json`、`chunks/*.json`：兼容现有文字理解流程，`cloudTranscription` 记录云端来源；不把大量词级信息塞进每个文本块，也不占用本地 Whisper 的 `transcription` 字段。
- `asr/doubao-response.json`：完整终态响应，包含词级时间、所有 additions 和未知扩展字段；供程序与定点复核，Agent 不先加载全文。
- `asr/doubao-request.json`：非敏感请求参数及请求 ID，绝不保存鉴权头。
- `asr/chunks/NNNN.json`：当前文本块对应的原始句段、起止秒、说话人等字段；清单项以 `asrMetadataFile` 指向它。长句拆成多个块后仍引用同一 `utteranceIndex`，不是按新块的下标猜测。
- `manifest.json` 的 provenance 与 `asr/complete.json`：云端来源、音频哈希、资源/请求 ID、实际时长、缓存状态与导出完成标记。

每次读取文字块后，用上面的豆包 `inspect` 分页读取其附加信息（每页最多20句，沿 `nextOffset` 继续），再写 Map 笔记。记下 `chunkId`、`utteranceIndex`、实际时间、speaker ID、关键原话与疑点；跨块归并时按同一原始句段去重。全部块处理后按现有总结流程归并、写作并检查覆盖，不能把 inspect 的第一页当作全部信息。

解释规则：

- Speaker ID 只在本次识别内区分声源，不是真人姓名，也不能跨独立裁剪会话直接合并。旁白、引用片段与画面人物可能不同；引述归属由文字和实际读取的素材核实。
- 情绪是有限类别的模型输出，不能等同于讽刺、态度、心理状态或事实真假。`neutral` 也不证明声音没有情绪。未回听时写“ASR 标记为…”，不能写“听到…”。正文以内容为主，只在有助于理解时引用语音附加信息。
- Score 可能是字符串形式的数值，不能把它当作已校准的正确率；解析失败保留原值。语速/音量的单位和范围需按当前官方文档解释，跨录音比较须考虑录音条件。
- 同一 speaker 的 gender 不一致、专名/数字可疑、断句重复或中间长空档列为复核项，不按性别拆成新角色，不根据上下文默默修正。需要时定点回听；人工更正记录原文及依据。
- 已有3分钟真实测试返回了说话人等全部请求字段，但情绪全部为 `neutral/weak`；验证的是字段获取和保存，尚不能据此断言多情绪识别准确。

## 缓存与失败恢复

默认缓存 `~/.cache/video-summarizer/doubao`；可用 `--cache-dir` 指定。缓存键包含规范音频哈希、请求参数、资源及 helper 版本，不依赖文件名。只复用校验通过的终态响应；换标题、块大小或交付目录不重新上传同一音频。此时即使未提供 key 也可离线导出。缓存由本机使用，不能作为不同账户/音频的身份凭证。

一次完整会话只保存最终全量结果，不把连续更新重复拼入字幕。未完成会话写 `attempt.json`；断连、超时、取消后不自动重发，避免结果未知时重复计费。先检查记录和账户状态，确需重新上传才显式传 `--retry`；换输出目录不会绕过此保护。`DOUBAO_BUSY` 时确认锁记录的进程已结束后再处理残留锁。403需检查资源是否开通、key权限和授权生效状态，不忙重试。

开发/复核可用 `prepare --import-response '/absolute/terminal-wrapper.json'` 导入已保存的完整终态响应，无 key、无网络；响应须包含 `code/is_last_package/payload_msg` 并匹配音频时长。导入记录 `imported=true`、`requestId=null`，不假造 API 请求，也不写入在线完成缓存。时长一致不证明响应来自该音频，调用方须确认配对。

## 官方资料

- [API key 使用](https://docs.volcengine.com/docs/DoubaoVoice/APIKeyUsage?lang=zh)
- [双向流式 ASR WebSocket](https://docs.volcengine.com/docs/DoubaoVoice/bidirectional-streaming-automatic-speech-recognition-websocket?lang=zh)
- [说话人分离](https://docs.volcengine.com/docs/DoubaoVoice/speaker-separation?lang=zh)
- [计费说明](https://docs.volcengine.com/docs/DoubaoVoice/Billinginstructions-21)：运行前以账户当前额度、价格和扣费规则为准。
- [录音文件识别任务提交](https://docs.volcengine.com/docs/DoubaoVoice/task-submission-http-1?lang=zh)：供后续 AUC 批处理评估，不适用于当前流式命令。
