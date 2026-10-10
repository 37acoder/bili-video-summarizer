# video-summarizer skill 验收记录

日期：2026-10-10（Asia/Shanghai）

结果：可安装的 Agent skill 已完成，CLI 提取/鉴权/分块及 Agent 自行总结路径通过验证。无需额外 LLM API key。依然是字幕分析，不包含音频转录、画面识别或截图。

## 安装与实现

- 技能源码及分发包：`skills/video-summarizer/`。
- 当前共享安装：`/Users/polozhong/.agents/skills/video-summarizer/`。初次安装曾放在 `.codex/skills`，已迁移。
- 个人技能归档：`/Users/polozhong/knowledge-base/skills/owned/video-summarizer/`。
- 可执行入口：`node <skill>/scripts/video-source.cjs`，运行需要 Node.js 22+，依赖已打包。
- 维护源码：`src/agent/{auth,prepare,cli}.ts`；构建：`npm ci && npm run build:skill`。
- B站新增 HTTP/API 错误透传和不存在的分P拒绝，防止静默取错分P。
- 登录支持二维码 PNG + 单次/持续轮询、SESSDATA/Cookie 文件导入、nav 登录验证。保存文件权限 0600，原子替换；日志不输出 Cookie。
- `prepare` 将字幕保存为有哈希的有序 JSON 块；预算包含文件结构，超长单行也会切分。`inspect` 每次最多输出 20 条清单索引。
- 总结参考提供章节模板、subagent Map-Reduce 合同、无 subagent 的串行及进度续跑规则。

## 验证结果

| 验证 | 结果 | 范围 |
|---|---|---|
| Skill frontmatter/目录校验 | 通过 | 本地安装与仓库包 |
| `npm run typecheck` | 通过 | 所有 TypeScript |
| `npm run build` | 通过 | 原有库的 ESM/CJS/类型声明 |
| `npm run build:skill` | 通过 | 独立 CLI 打包 |
| `npm test` | 79/79 通过 | 既有测试 + 4 个 Agent 集成流程 |
| QR/Cookie 模拟集成 | 通过 | 等待扫码、等待确认、成功、过期、失效凭据、导入、文件权限和清理 |
| 分P和长文本集成 | 通过 | P2、错误分P、Cookie 不发给字幕 CDN、超长单行、密集短行、原文完整保留 |
| 无 API key 的 CLI | 通过 | 仓库外 cwd、本地字幕、清单分页、缺字幕退出码 1 |
| 真实 B站登录状态 | 通过 | 使用仓库已有环境凭据，nav 确认有效 |
| 真实 B站字幕提取 | 通过 | BV1KLhi6oEh5，49 项字幕、4 块，非简介回退，预算 1500、最大文件估算 1491 tokens |
| 真实二维码端点 | 部分真人链路 | 生成可用 PNG，poll 返回 waiting_for_scan；未要求用户扫码 |
| OpenCode 完整总结 | 通过 | 4 块、49 项全部覆盖，4 map + reduce + 中文 summary，简介输入被拒绝 |
| OpenCode 长文与续跑 | 通过约定的局部任务 | 2,415,200 字节 / 9,800 行合成输入 → 323 块；两次会话先后完成第 1、2 块并保存进度 |

长文本测试是重复现有样本构造的合成数据，用于验证上下文与续跑流程，不是另一个真实长视频。它没有执行完全部 323 块：检查点明确留下 321 块、下一块 0003，没有生成或声称完整视频总结。

恢复会话使用了 inspect 分页，未把原始转录、完整 transcript.json 或完整 manifest 加载进模型上下文。它仍直接读取了当时较小的 progress.json；超大任务的检查点应按技能说明用程序提取简短状态。token 数为估算而非精确 tokenizer，Agent 仍需给历史、指令和输出保留余量。

## OpenCode 委派证据（以下首轮测试显式提供技能绝对路径，未验证自动发现）

通过指定的 `/Users/polozhong/.agents/skills/opencode-delegation/SKILL.md`，使用 OpenCode v2.0.26 异步 API、显式 project directory、独立 Session。请求未指定模型，完成消息回读到实际模型 `opencode-go/deepseek-v4.1-flash`。

| Session | 任务 |
|---|---|
| `ses_58f2f35f489f4e8ba8f41fcdc1e317c5` | 首轮完整流程，6 块 |
| `ses_fba4eb107a304f42aa10ea989cf05099` | 含 JSON 预算的完整流程，4 块 |
| `ses_527d91985a1847128546c7cc943eceae` | 2.4 MB 合成输入准备 + 第一块 |
| `ses_f12b6a7089204cce9262a3299a1d2b37` | 分页读取清单、恢复并完成第二块 |

保存并核对了请求 ID/正文/hash、location、succeeded outcome、新 idle、无待处理 inbox/permission/form、无 active execution、无子任务，以及完成的 stop 响应。协调方另外核对 chunk 哈希、map 文件覆盖、item 连续性、章节时间戳、检查点和实际产物；不是仅依赖 worker 的“PASS”。

验证中发现 worker 会提前读取原始文件，已将入口改为直接将路径交 CLI；大清单另提供 inspect，避免直接读取全文。最终复验覆盖了对应修正。

## 可复查材料

- [OpenCode 生成的完整中文摘要](opencode-summary.md)
- [worker 的完整流程记录](opencode-worker-validation.json)
- [协调方独立检查](coordinator-check.json)
- [真实提取记录与运行包哈希](live-extraction.json)
- [长文续跑独立检查](long-resume-check.json)

worker 材料中的 `/tmp` 路径是当次执行现场，可能被系统清理；本目录保存的报告、摘要和检查结果可长期复查。样本原文在 `examples/samples/BV1KLhi6oEh5.input.txt`。原始二维码/key 已从本次临时目录清理，凭据未复制到仓库或验收材料。

## 尚未现场验收

- 新二维码经用户扫码确认后实际获取新 Cookie：状态流转和存储已模拟测试，真实登录测试用的是已有 session。
- Browser 工具的 Cookie 导出：不同宿主 API 不同；技能提供支持边界及用户手动导出方案。
- YouTube/savesubs 现场提取：沿用仓库实现，此轮未声称网络可用性已验证。
- 真正多 worker 并发 Map-Reduce 与跨宿主 compaction：提供流程合同；本轮 OpenCode 专门验证无 subagent 分支。

## 安装目录与原生发现复验（2026-10-10 补充）

初轮安装到 .codex/skills，且委派提示直接给出了 SKILL.md 绝对路径，因此初轮只能证明 OpenCode 能读取该文件并执行，不能证明安装发现正确。此项验收遗漏已更正：

- 技能已迁移到 /Users/polozhong/.agents/skills/video-summarizer，.codex 下旧目录已移除。仓库安装说明和个人技能归档均已更新（知识库提交 d2c6fd7）。
- 新会话 ses_f3b2c54c60a94025ae0d8769bd82dc8e 的提示未提供技能名称或路径，只要求通过原生 skill 工具选择合适的视频总结技能。
- 实际调用为 skill({"id":"video-summarizer"})；工具返回 metadata.directory=/Users/polozhong/.agents/skills/video-summarizer，状态 completed。随后实际运行该目录内的 CLI。
- 会话 outcome=succeeded、finish=stop；无待处理输入、无活动执行或子任务。协调方核对 4 块、49 项的 map 覆盖、哈希、章节时间戳和完整摘要。
- 本次用于验证安装发现与执行；worker 在短样本上仍执行过 head/cat 原始文件，因此不把这次结果作为超长输入上下文遵从性证据。

可复核：[原生 skill 调用及未注入路径的任务提示](native-discovery.json)、[独立产物检查](native-discovery-execution-check.json)、[本轮生成的摘要](native-discovery-summary.md)。
