# 文章化技能与真实Luna运行验证

2026-10-12，本轮把默认视频总结改为可独立阅读的文章：正文用问题、经历、理由与反问组织；普通内容标题与后台段落来源分开；编辑判断使用独立AI评论。图文或仅文字是媒介选择，文章或纪要是另一项选择。共用行文规则按需加载，图片策略和HTML模板仅在图文分支加载。

修改集中在SKILL入口、共用行文、文字/图文输出、来源核验说明和分类模板。模板按实际内容拟小标题，来源与回看折叠在文末，访谈图文允许少量有场景作用的原帧。图文与仅文字分类配置仍由同一分类源生成。长片拆篇后要检查主要议题的承接，避免把处理完所有字幕块等同于成稿保留了主要内容。

来源核验新增mode=article：普通H2/H3与chapters.json一一对应，claim绑定原样正文，校验item、原始引文与实际秒数。AI引用块不能通过来源文件被重新标成原片正文；无时间文稿不补造秒数。原时间轴模式继续保留。结构通过不代表语义支持，交付仍需读原文审查。

集成验证覆盖乱序主题章节、合法与伪造引用、错误时间、正文绑定、AI重标和无时间来源。类型检查通过，全部13个测试文件共101项通过；没有为简单文案或每个函数增加单元测试。

真实运行使用Codex CLI 0.161.0与gpt-6-luna，素材为BV1fcHD6cEw3的既有平台字幕与原帧。32块字幕共1010项分别理解、归并，最后形成五篇文章。首轮审读发现编辑判断混入正文、关键细节与来源缺失；后续发现拆篇遗漏重要主题。经两轮反馈与主审编辑，五篇来源核验通过，54个正文段落和12段评论的HTML/Markdown一致；真实Chrome在1280与390宽度检查目录和五篇，共12个页面通过。

仓库技能已同步到/Users/polozhong/.agents/skills/video-summarizer；格式检查通过，60个文件内容一致。原有总结及各轮草稿保留。没有把稀疏视觉抽样、平台字幕或结构核验称为全片视觉理解和外部事实核验。

成果与详细审阅：[文章目录](/Users/polozhong/repos/video-summarizer/review/BV1fcHD6cEw3-luna-article-20261012/articles/index.html)、[审阅报告](/Users/polozhong/repos/video-summarizer/review/BV1fcHD6cEw3-luna-article-20261012/review.md)、[真实运行记录](/Users/polozhong/repos/video-summarizer/review/BV1fcHD6cEw3-luna-article-20261012/logs/run-config.json)。
