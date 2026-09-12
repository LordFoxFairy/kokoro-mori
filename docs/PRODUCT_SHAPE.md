# Mori 产品形态基线

> 目的：把 Mori 从“一个漂亮的生成表单”打磨成真正可持续使用的 AI 音乐工作台。

## 一、先定用户心智

用户不是来和一个聊天机器人闲聊，而是带着一个模糊的音乐意图来完成一件事：

```text
我想做什么 → AI 如何理解 → 我比较哪些结果 → 我保留哪一版 → 我如何继续打磨
```

因此 Mori 的主对象不是消息，而是 **Project**。Prompt 只是意图输入，Song Plan 是可检查的
中间产物，Candidate 是可试听的探索结果，Version 是可以继续编辑和导出的工作成果。

## 二、从成熟 AI 产品吸收的模式

### 1. Suno：生成和制作要处于同一个上下文

[Suno Studio](https://help.suno.com/en/articles/7940161) 把 Create、Library、Upload、
Details 和 Transport 放进同一工作区；生成出来的多个 Take Lanes 可以试听后再提交到主轨，
Studio 还自动保存版本。这个模式说明：生成不是一次性结果页，而是持续可回看的制作上下文。

Mori 的落地：

- Create 负责快速起意，Queue 负责承接生成状态和候选；宽屏 Queue 是不阻断输入的并列工作栏，紧凑屏幕才使用
  管理焦点的抽屉，让用户在生成运行时仍能继续调整创作表单。
- Queue 中每个候选把“选择为当前播放器目标”“试听”“进入 Studio”“设为 Current Version”分成明确动作；
  选择控件可键盘聚焦并显示稳定高亮，不让整张卡片承担不可见的副作用。
- Home 的一句话 Quick start 通过可分享的 GET seam 把想法带入 Create；Create 只预填草稿，仍先让用户检查
  可编辑 Song Plan。Project 建立后会从地址中移除原始想法，避免长期保留用户输入。
- Create 不是已完成作品，不提供会复制当前表单 URL 的假 Share；Studio 只提供明确的 `Copy link` 深链动作，
  并在浏览器确认剪贴板写入后才显示成功；紧凑顶栏用加载、成功、失败图标保留同等可见反馈。真正的分享 / 发布
  属于具备持久化契约的 Release，而不是顶栏装饰。
- Global Player 在页面切换时保持不变，不把试听变成一次性弹窗。
- Global Player 的播放队列跨页面可用，并与 Create 中展示生成任务的 Generation Queue 明确分离。
- Studio 只在 Project + Version 上下文内出现。
- 当前先落地 Take Lanes：生成的方向可试听、对比，再明确提交为当前版本；Lyrics 草稿和 Stems
  分离也沿用这条闭环；成功 Stems 通过受信同源媒体投影进入同步 audition mixer，真实音频字节继续由
  BFF 与 Storage owner 承接。
- Take Lanes 中打开、播放、选择与 Project Current 保持分离；`Use take` 是带幂等与并发条件的持久化命令，
  只有精确确认后才改变 Current，失败不会让用户看到一个假的成功状态。
- Version history 在宽屏 Studio 中保持为项目右栏，在中等和移动宽度收进 Studio 顶部的 Versions 抽屉；
  两种表面复用同一组 Version 状态，并分别标明 Open 与 Current，缩窄画布时也不会失去回看入口。
- Finish 仍绑定当前 Version：Remaster 的音频结果回到 Take Lanes，Release 的视觉与元数据只进入 draft，
  两条路径都不会绕过用户确认或偷偷发布。
- Studio 的自然语言协作留在当前时间线选区；每种命名操作提供少量可编辑 prompt starter，降低空白输入成本，
  但点击 starter 不会生成，仍必须先复核结构化 Change Plan。任务切换后先用一句结果导向说明解释当前能力，
  高级控制统一收在 `Keep & compare`，不要求用户理解 anchor 等内部术语。

### 2. Figma First Draft：AI 先给可编辑的第一稿

[Figma First Draft](https://help.figma.com/hc/en-us/articles/23955143044247-Use-First-Draft-with-Figma-AI)
强调从 prompt 得到可编辑草稿、比较不同主题、继续 Make changes，而不是把 AI 输出当成最终答案。

Mori 的落地：

- Smart 模式先形成 Song Plan，再让用户决定是否进入生成。
- Song Plan 的 mood、tempo、structure、voice direction 都应能被修改或重新生成。
- 候选始终保留原始生成上下文，用户可以重新试听、Promote、Remix 或继续编辑。

### 3. ChatGPT Canvas / Claude Artifacts：对话退到辅助位，产物进入主位

[ChatGPT Canvas](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it)
把可编辑内容放到独立画布；[Claude Artifacts](https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)
把可复用产物放到右侧专用窗口和独立空间。共同点是：AI 可以解释和协作，但用户最终操作的是
一个稳定、可编辑、可复用的对象。

Mori 的落地：

- 不把 Create 做成聊天记录列表。
- AI 的解释以 Song Plan、生成阶段、候选标签和版本历史出现。
- 用户可以直接操作歌词、结构、试听、版本和导出；AI 不替用户隐藏关键决策。

### 4. Tad：能力分类清楚，但要回到作品上下文

[Tad AI Music Generator](https://tad.ai/ai-music-generator) 用 Generate、Reference、Remix、Edit
区分用户意图，并继续提供 Cover、Vocal Remover 和 MV 等独立能力。Mori 吸收它清晰的操作分类，
但不把这些能力全部提升为全局工具页：Reference 留在 Create/Library，Remix、Edit、Extend、音乐 Cover / Restyle
回到当前 Version 的 Studio 上下文，Vocal Remover 回到 Stems，MV 放在 Finish/Release。Release artwork 只负责视觉身份，
不会与音乐 Cover 共用名称、任务状态或结果去向。

完整能力归属、操作语义与打磨顺序见 [`MUSIC_CAPABILITIES.md`](./MUSIC_CAPABILITIES.md)。

## 三、Mori 的布局法则

### 桌面端

```text
固定 Rail        当前工作区                               固定底部 Player
品牌 / Create    Create、Project Overview 或 Studio       当前版本 / Transport / Queue
Workspace nav    内容随项目上下文变化                     跨页面保持
```

- Rail 是应用骨架，不是悬浮卡片；展开/收起不改变内容的语义位置。
- Create 的第一主操作只有一个：Smart 先 Review plan、Custom 直接 Generate；Smart 复核时用 Song Plan 替换原始输入面，
  `Back to idea` 再恢复草稿，不让输入、复核和重复说明同时堆叠；Queue 是当前任务的上下文入口。
- Studio 的工具和版本历史属于项目，不提升到全局 Rail。
- Studio 只保留全局 Player 这一套 Transport，不在画布标题旁复制 Preview；左侧用可读的 Current / Open take
  状态代替内部 Version ref，并将承载 Add Vocals 的工作区明确命名为 Voice & stems。
- Finish 与 Export 的来源选择同样只显示歌曲名、时长、保存的混音名称与轨道数；opaque ref 留在契约核对中，
  不再泄露到用户需要理解的界面。
- Export 是可恢复的后台任务而不是一次性弹窗：窗口关闭后，顶栏入口持续显示 Exporting、Ready 或 Needs attention，
  紧凑布局用同色状态图标表达相同信息；点击原入口即可回到进度、下载或重试。
- Studio 在大于 1360px 时使用工具 / 画布 / Version history 三栏；在 1360px 及以下保留工具与画布，
  Version history 由标题栏动作打开右侧抽屉，不把主画布继续挤窄。
- Player 使用独立的全宽 transport dock：左侧当前作品，中部 transport + progress，右侧
  音量和 `Up next` 播放队列；Create 的 `Generations` 入口只承载生成任务，两者不混淆。
- Settings 使用浮在当前工作区之上的窗口：左侧固定偏好导航，右侧独立滚动设置内容；关闭后
  回到原来的 studio 语境，不把设置拆成另一套页面壳体。
- 移动端保留 Rail 的 compact 入口和 Player 的核心播放操作，不把桌面三栏硬缩成一张卡。

### 每个 AI 状态都要回答一个问题

| 状态 | 用户看到什么 | 用户下一步 |
|---|---|---|
| Empty | 我可以从什么开始 | 输入一句想法或选择快捷入口 |
| Planning | AI 正在如何理解我的想法 | 等待或取消 |
| Ready to generate | Song Plan 的结构化摘要 | 修改/确认后生成 |
| Generating | 阶段、进度、取消入口 | 等待、取消或继续浏览 |
| Candidates ready | 可试听的多个方向 | A/B 对比、选中、设为当前 |
| Current version | 项目中正在使用的版本 | 打开 Studio 继续打磨 |
| Exporting | 输出格式和任务状态 | 等待下载或重试 |

核心原则：**AI 可以加速探索，但不能让用户猜测系统正在做什么，也不能偷偷替用户提交重要改变。**

## 四、当前 Mori 实现对照

- 已有：Project-first 导航、Contextual Queue、全局 Player、Candidate → Version → Studio。
- 已有：Smart/Custom、浅色渐变视觉、浮窗式设置分组与 compact Rail。
- 已落地第一版：Song Plan 从提示说明升级为可编辑、可确认的中间状态，并在确认后通过契约持久化再创建生成任务。
- 已落地第一版：Studio Take Lanes 支持试听、选择和明确提交当前版本；Open Version、Playing、Selected Take 与
  Current Version 分开建模，`Use take` 通过 Project-scoped compare-and-set 契约提交，等待与失败期间保留旧
  Current，可重试故障复用同一幂等键，并发冲突要求刷新；Version history 只按确认的 Project Current 标记，
  并在宽屏常驻右栏、中屏/移动端上下文抽屉中始终可达。历史行把正在查看的 Open 与项目确认的 Current 独立展示，
  抽屉支持焦点约束、Escape / 遮罩关闭、导航关闭与焦点返回。
  Lyrics 支持本地草稿保存、分段 AI Revision、
  多 Suggestion 对比以及 Apply / Undo；Stems 支持基于当前 Version 的 Vocals or one part、Full stem split、Choose parts
  三种渐进意图、可选 MIDI、异步恢复/取消/重试，以及对真实返回资产的逐轨 Mute/Solo/Level；
  默认把 Tad 风格的 Vocal Remover 心智翻译为清楚的 Vocals + Instrumental 结果，其他单轨目标则明确为目标轨加
  不含该轨的 mix；Choose parts 要求 2–10 个稳定目标。成功结果现已提供共享 Play/Pause、Seek、
  同步校正和单轨下载；与全局 Player 互斥，媒体失败时明确报错，不用 preview 音频顶替。用户可以把完整 Gain / Mute
  明确保存为不可变 Mix Revision，失败时调整仍保留，Solo 只属于试听态，不进入持久化请求。Studio Export 已从
  固定 MP3 快捷动作升级为显式渲染流程：可选择 Studio 当前打开的 Version 或最新 Mix Revision、MP3/WAV 与 Full song，
  提交后在同一窗口跟踪异步状态；创建结果不确定时使用原幂等键安全重试，瞬时状态读取失败继续跟踪原任务，成功才提供下载。
  Project/Version/source/scope/format 任一上下文不匹配都会被拒绝；尚未具备真实输入的选区和多轨范围不会伪装成可用控件。
- 已落地第一版：Studio 顶部 Finish 把 Remaster 作为作品完成动作，而不是 Rail 中的独立 AI 工具。用户可从当前
  Version 或最新保存的 Mix Revision 开始，选择 Subtle / Balanced / Bold，Review 整首范围、保护约束与两条 Take
  去向后再运行。任务可在窗口关闭后继续并恢复；snapshot 来源或强度不匹配时拒绝挂接，成功结果只进入 Take Lanes，
  用户显式 Use take 前不改变 Current。
- 已落地第一版：Finish 的 Release 页签把 Title、Description、Visibility、Remix permission、Explicit content 与
  Artwork 保存为当前 Version 的 draft。默认 Private，可见性与允许 Remix 分开；唯一主动作是 Save release draft，
  当前没有 Publish command。Artwork 可沿用当前图，或先 Review 固定 1:1、无文字、四候选的异步计划，再从成功结果中
  选择一张图片。Artwork snapshot 必须完整匹配 Version 与计划，图片只进入 draft，不进入音频 Take Lanes；关闭窗口后
  草稿与任务仍可恢复，切换 Version 时清理旧上下文。
- 已落地第一版：Stems 已形成 Voice & stems 上下文工作面，在 Separate mix 旁提供 Add vocals 与 Add instrumental。
  Vocal layer 将必填 Lyrics、可选 Voice profile 和 Vocal direction 分开；Instrumental layer 只要求编曲方向。
  两者都先显示 whole-song Layer Plan，复用 version-scoped `add_part` Generation lifecycle，并把结果送入现有
  Take Lanes；切换子工作流保留未提交草稿，离开再返回也能恢复运行中的图层与取消入口。
- 已落地第一版：Studio 的 Mori AI Changes 把 Add part、Replace section、Extend、Transform 放在
  Arrangement 时间线上下文中；时间线播放头与全局 Player 双向使用同一位置状态，并明确标记当前段落。
  用户可选择结构段或拖动起止控制形成 Custom range，再输入指令并复核 Change Plan；每种操作的少量 prompt
  starter 只预填并聚焦可编辑输入，不会自动执行；移动范围会让旧 Plan
  失效。Transform 进一步拆成 Restyle / Cover 两个可读意图：Restyle 可使用选区或整首，并保留用户选择的
  anchors、references 与 1 / 2 / 4 个输出；Cover 固定使用 open Version 的整首音频，不要求重新上传，按 Vocal /
  Instrumental 决定可选 Voice 与严格保护项，并固定输出两条 Take。界面与 Review Plan 都明确区分 audio Cover
  和 Release artwork；服务返回的完整 typed snapshot 必须与复核计划逐字段一致。最终结果进入 Take Lanes，
  当前版本不会被直接覆盖。
- 已落地第一版：Project Overview 的 `Continue making` 将 Tad 的任务分类落成五个当前版本动作：Remix & edit、Cover、Lyrics、
  Voice & stems、Remaster & release。Remix & edit 与 Cover 都进入 Arrangement，但分别预选 Restyle 与 Cover；两者不再
  复用含义模糊的 “Restyle or cover” 单一入口，用户从 Project 详情页即可知道下一步会改变什么、结果回到哪里。
- 已落地第一版：从项目详情、Studio 或项目上下文中的 Rail 进入 Create 时保留 `project_ref`，
  生成命令不再意外落到预览项目；可用时先读取项目 projection 展示项目名称，读取失败保留中性上下文。
  无 `project_ref` 的全局 Create 明确显示为 New project，首次确认生成时用同一句 idea 自动建立 Project，随后才在
  该 Project 下创建 Song Plan / Generation；地址与 Rail 上下文同步替换为新 `project_ref`，刷新、设置返回和失败重试
  都不会重新落回示例 Project 或重复创建 Project。尚未运行过生成时，Queue 显示真实空态，不展示示例 Plan/Candidate。
- 已落地第一版：Prompt 下方的 Creative sources 把 Audio、Voice、Inspiration 作为 Smart / Custom 共用的
  上下文输入，而不是继续堆全局 AI 工具。Audio 使用真实文件选择或浏览器录音，并执行格式/大小校验；Voice 使用稳定 preview
  `voice_ref`，与本次生成的人类可读 Vocal direction 分开；Inspiration 只提供少量策展起点并写入仍可编辑的
  Style。Library 的 All 视图已经将作品与素材分区，Sources 视图按 Audio / Voices / Inspiration 渐进筛选；
  `Use in Create` 会通过经校验的 provider-neutral source ref 恢复同一个创作上下文。当前素材为确定性 preview，
  正式资产引用与 projection 继续由 storage/music owner adapter 承接。
- 已落地第一版：Create 把 Approach（Smart / Custom）和 Output（Song with lyrics / Instrumental）作为两个独立、
  始终可见的选择，不再把作品类型藏在 Custom 参数或底部快捷入口。Instrumental 会同步移除 Voice、Lyrics、
  Vocal direction 与请求中的 `voice_ref`，Song Plan 改用 Arrangement / Creative intent 文案；从 Library 带入 Voice
  则明确进入 vocal output，避免界面、计划和契约表达不同的作品类型。
- 已落地第一版：Library 只展示已有投影支持的 All / Projects / Versions / Sources；Lyrics 继续属于 Project/Studio，
  Export 继续属于打开 Version 的 Studio，不用永远为空的筛选器伪装成全局能力。Projects 与 Versions 两个投影统一结算：
  任一真实投影成功后都不会再混入另一侧的示例数据，部分失败显示明确可用性提示；Current Version 标签只依据对应
  Project 的 `current_version_ref`，不再与示例项目比较。
- 已落地第一版：Projects 列表不再用统一的模糊续作入口。已有 Current Version 的 Project 直接回到对应 Studio；
  已有候选但尚未确认 Current 的 Project 回到 Project Overview 比较 Directions；空 Project 直接进入 Create 开始
  第一条 Direction。新建 Project 后的主动作同样是开始第一条 Direction，减少一次没有决策价值的页面跳转。
  Project 的 `current_version_ref` 是续作入口的事实来源；即使 Candidate projection 暂时不可用，已确认作品仍可进入
  Studio 和对应的 Transform / Lyrics / Stems / Finish 上下文，不因辅助列表故障失去主路径。
- 已落地第一版：Projects 目录只保留页首一个 New project 主入口，不再用同尺寸的空卡重复抢占注意力；每张作品卡
  整体都是唯一续作入口，并使用可扩展的紧凑网格承载更多工作区。卡片仍明确显示 Project 状态、Current Version 与
  下一步动作，吸收成熟音乐产品的可扫描密度，但不把 Projects 降格为一次性歌曲封面墙。
- 已落地第一版：Create 的 Generation Queue 与 Project Overview 不再本地伪造 `Set as current`。它们与 Studio Take Lanes 复用同一个
  Project-scoped Current Version command、期望旧 Current、幂等重试和完整响应核对；提交确认前保留原 Current，
  失败提供可解释的重试/冲突状态。Overview 只在确认后才更新 `Open Studio` 与 Continue making，既有 Project 的
  `current_version_ref` 会先从 projection 恢复为并发条件。
- 后续：Song Plan 的服务端版本历史、正式音频上传、版本自动保存，以及建立在真实时间选区和多轨交付模型上的
  更多导出 scope；AI MV 与真正的 Publish command 保持为完成歌曲后的后置流程。

## 五、明确不做的方向

- 不做纯聊天首页：聊天不能替代 Project、Version 和 Library 的对象关系。
- 不把所有 AI 能力塞入全局 Rail：工具应在当前 Project/Version 的上下文中出现。
- 不照搬 Suno、Tad、网易云的品牌颜色、文案或页面代码；只吸收已经验证的交互关系。
- 不在 Mori 前端绑定供应商私有字段；真实 provider 接入继续通过既有契约边界完成。
