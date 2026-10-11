# 豆包技能补充验收（2026-10-11）

## 交付

- 可选入口：`scripts/doubao-transcribe.py`，构建时复制到技能 scripts；新增独立说明 `references/doubao-transcription.md`，入口与安装说明按需链接。
- 支持选定音轨下载、已有音频规范化、一次流式会话、最终完整响应保存、字幕任务导出、逐块附加信息分页读取，以及完成缓存和显式失败重试。
- 请求包含说话人、情绪、声音性别、语速、音量、语种及句/词时间信息；原始响应保留全部扩展字段。附加信息不混入文本块预算，也不与本地 Whisper 的 `transcription` 字段冲突。
- 已更新本机 `~/.agents/skills/video-summarizer`，保留其现有图文/本地转录及字幕 CLI。当前工作树的旧字幕 CLI 也可使用同一 helper。没有覆盖另一个源码 checkout 的未提交改动。
- 已将此前授权保存的 key 配置到本机默认私有文件（0600），不写入技能或仓库；doctor 无网络检查通过。doctor 不重新验证服务开通状态。

## 验证与结果

| 检查 | 结果 |
| --- | --- |
| `npm run build:skill` | 通过，helper 随发布技能打包 |
| `npm run typecheck` | 通过 |
| `npm test` | 原有10个测试文件、79项通过 |
| `python3 test/doubao_skill_integration.py`（亦可 `npm run test:doubao`） | 4条本地集成流程通过 |
| 同一4条流程，`DOUBAO_TEST_SOURCE_CLI=~/.agents/skills/video-summarizer/scripts/video-source.cjs` | 通过，验证新版字幕 CLI 兼容性；实际命令使用绝对路径 |
| 工作树及已安装技能 quick_validate | 均通过 |
| 入口/安装/豆包文档相对链接 | 无缺失 |
| Python 3.9语法、源码/打包/安装 helper 一致性、实际 key 隔离扫描 | 通过 |

集成测试只用本机 WebSocket 模拟服务、合成音频/响应和临时假凭据，不调用付费服务：

1. 校验二进制协议、gzip、请求附加信息开关、音频顺序与最后一包；导出长句拆块、保留原始扩展/词数据，分页读取；更换任务目录后复用缓存，不重复上传；显式导入覆盖缓存选择，不假造请求 ID。
2. 403在音频上传前失败；记录拒绝状态，换目录不会隐式重试，显式重试才重新请求。
3. 上传后缺失终态：结果未知，不产生完成标记，不自动重发。
4. B站分P音轨下载：保留API原标题、选定cid、时长和音频哈希；临时Cookie权限正确，命令参数不含其值，输出不保留签名URL，临时目录清理。

## 真实结果回放

使用上一轮已经完成的 BV12ftJ6rEkw 前180秒音频及保存的豆包终态响应，**本轮新增云调用0次**。分别通过工作树和已安装技能的完整 prepare 路径，使用128 token预算验证：

- 10个原始句段分别导出为15个块；文字拼接与原句段一致，各块估算文件token均不超过128。
- 每个文本项仅对应一个原始句段，speaker及起止时间一致；跨块同一句段保持同一utteranceIndex。
- 784条词级记录及全部原始响应逐项保留；imported=true、requestId=null，不将导入写成一次新API调用。
- 回放结果保留在本机原实验工作树的 `docs/validation/volcengine-api/skill-replay-check.json`，不作为技能运行时依赖。

这验证了新 helper 的传输、保存、分块和恢复流程，以及此前真实结果的兼容性；不是新增云端识别准确率测试。旧真实测试所有情绪均为neutral/weak，尚不能据此验证多情绪准确率。当前接入为实时流式2.0，未实现AUC批处理或自动注册到库的fetchTranscript。

## 安装与同步

按 skill-repository-sync 归类为个人技能，来源为 `/Users/polozhong/.agents/skills/video-summarizer`，同步至 `/Users/polozhong/knowledge-base/skills/owned/video-summarizer`。验证后提交并推送 `8cba465` 至知识库 main；目标仓库状态干净。本次同时同步了该个人技能先前已安装的图文/本地转录资源，保留完整发布目录；技能补充阶段的项目工作树改动当时未自动提交或合并至另一源码 checkout。


## main 整合复验

用户随后明确要求合并到 main。以 origin/main 的 `45ba4c7` 为基线，在隔离的 `codex/doubao-asr-main` 分支整合；SKILL.md 与 setup.md 的两处冲突按主线现有图文、本地转录和执行恢复流程保留，再添加豆包选项及丰富信息分页规则。README 增加豆包入口，构建检查包含独立说明并打包 helper。

整合后 `npm run build:skill`、`npm run typecheck`、`npm test`（12个文件、91项）、`npm run test:doubao`（4条本地集成流程）、quick_validate 与文档链接校验通过。通过整合后打包技能再回放真实180秒结果：15个块、10个句段、784条词记录保持对应，未新增云调用。主目录中其他未提交改动不参与本次提交。
