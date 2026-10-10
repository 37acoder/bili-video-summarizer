# 按观看目的选择一个模板

仅由图文流程到达本入口。以下是编辑分类，不是B站官方分区或自动分类器。选定后只读取该项配置；HTML/Markdown是输出素材，使用时再展开，不把所有模板载入上下文。

| ID | 类别 | 阅读价值与样式 | 所选配置 |
|---|---|---|---|
| tech | 科技数码 | 步骤、效果、限制；柠檬黄/薄荷绿实验室 | [tech.json](../assets/article/profiles/tech.json) |
| lecture | 课程讲座 | 概念递进、推导、例子、问答；靛蓝笔记与荧光提纲 | [lecture.json](../assets/article/profiles/lecture.json) |
| interview | 访谈播客 | 追问、分歧、修正及发言归属；葡萄紫/蜜桃对话卡 | [interview.json](../assets/article/profiles/interview.json) |
| recording | 录音实录 | 时间线、发言过程、明确结论与未决项；青绿档案页 | [recording.json](../assets/article/profiles/recording.json) |
| science | 严肃科普 | 机制、实验、证据和条件；冷白/深蓝原理页 | [science.json](../assets/article/profiles/science.json) |
| analysis | 知识评论 | 主张、推理、反例和限定；纸白/砖红杂志页 | [analysis.json](../assets/article/profiles/analysis.json) |
| documentary | 纪录纪实 | 人物、事件进程和不同材料；墨绿/赭黄现场页 | [documentary.json](../assets/article/profiles/documentary.json) |
| drama | 影视剧情 | 人物、冲突、伏笔与解说；深蓝/暖金放映室 | [drama.json](../assets/article/profiles/drama.json) |

生活体验life作为扩展，只在有路线、步骤或经验价值的长Vlog/游记/手作时读 [life.json](../assets/article/profiles/life.json)。娱乐综艺不属于主目录。

用户指定优先，内容主结构其次，作者语气覆盖默认风格。科学家圆桌可用interview，系统教学用lecture，主张与论证用analysis；“科技/科学/历史”主题词不足以决定分类。无法确定时选最接近的阅读结构并说明混合内容，保留原叙述顺序，不强行重写。

输入媒介另记：课程录音用lecture + audio，音频播客用interview + audio；会议、现场讲话、口述回忆等回查素材用recording。音频里的回忆和观点仍有发言归属，实录不自动证明所说事件属实。对话卡仅整理原有差异，保持共识与修正，避免制造对立。
