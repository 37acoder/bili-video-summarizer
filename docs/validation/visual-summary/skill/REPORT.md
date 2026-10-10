# 图文经验进入Skill：打包与流程检查

日期：2026-10-11。[技能入口](../../../../skills/video-summarizer/SKILL.md)。本轮依据writing-for-agents组织步骤、完成标准和条件指针；复用已验收的article-v2科技样例与category-v2模板。

## 渐进式披露

| 请求分支 | 读取路径 | 交付 |
|---|---|---|
| 默认“总结视频”或明确图文 | SKILL → summarization文字证据 + illustrated-summary → article-profiles → 所选profile；有视频才读visual-evidence | 默认HTML+Markdown，含有效原帧；按用户格式选择 |
| 明确“仅文字/不要图片” | SKILL → summarization → text-summary | 文字Markdown；不读视觉流程、分类配置或样式 |
| 只指定Markdown | 保持图文分支，按内容取材 | 可包含原帧的Markdown |
| 纯音频课程/访谈 | 图文文章分支，所选lecture/interview + audio；跳过视频取材 | 原主题、提纲/对照/回听索引，无强制图片 |
| 无平台字幕 | 原有captions_absent门控后才读local-transcription，缺项才读安装文档 | 取得自动转录后回到原模式，记录识别来源 |
| 视频下载失败/无法读图/无可靠时间轴 | 记录真实缺口，使用可支持的文字文章或独立未对齐画面说明 | 明确降级；不声称视觉分析成功 |

这是指令分支的人工审阅，不是对模型每次加载行为的自动测量。主文件26行；素材取材与文章写作分开，九类写作配置按类拆文件，生成包剔除合成demo正文。栏目、作者语气和输入媒介分别处理。

## 单一维护源与可移植性

仓库examples/illustrated-summary/categories的配置、样式及生成器是编辑模板事实源；build:skill调用package-article-assets生成技能assets/article（8主类+生活扩展，9组HTML/Markdown、单类JSON与本地CSS）。技能不依赖源码仓库路径。

prepare-article.mjs仅展开选中模板与必要本地资源，明确输出unfilled-skeleton；不会调用模型、生成观点或宣称完成总结。media=audio保留讲座/访谈主主题并用回听索引替换原帧块；recording默认音频。已有输出目录拒绝覆盖。

## 验证

- skill-creator quick_validate通过；UI元数据长度与资源指针检查通过。
- npm run build:skill通过；npm run typecheck通过。
- npm test：12个文件、88项全部通过，包含新增3项低成本集成过程：独立目录模板展开与本地样式、讲座/访谈/实录音频呈现、已有文章保护。未新增包装函数单测。
- [独立包与浏览器记录](package-checks.json)：只复制完整技能到临时目录，脱离源码后CLI help、真实已有转录prepare/inspect成功；9主/扩展模板+2音频变体，共11种展开场景通过，1440/390/320px均无横向溢出，title/H1一致、主题CSS可读、评论归属存在，重复展开保留已有文章。所有技能内相对文档链接可解析；单类配置未包含demo正文。
- 复用真实本地视频执行视觉文档中的ffprobe与定点抽帧：请求555秒，showinfo首帧PTS=555.016687秒，生成852×480 JPEG。这验证命令形式与时间记录；没有重新下载远端视频或听校字幕。

这些检查针对技能包、骨架和已验证命令。骨架保留占位符是预期状态，不能把展开当成成品生成。此前科技真实图文样例与八类设计验收仍有效；本轮没有另做模型自动分类、全片语义选帧、真实讲座/访谈/录音质量测试或YouTube下载验收。

## 安装与发现

完整包同步到本机共享目录~/.agents/skills/video-summarizer，保留旧版备份于本轮忽略的review目录；随后验证本机SKILL、脚本帮助及包文件一致性。更新技能发现通常需要新会话，本轮验证文件与执行能力，不把它写成新会话的发现测试。
