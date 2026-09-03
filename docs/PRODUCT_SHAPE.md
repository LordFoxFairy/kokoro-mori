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

- Create 负责快速起意，Queue 负责承接生成状态和候选。
- Global Player 在页面切换时保持不变，不把试听变成一次性弹窗。
- Global Player 的播放队列跨页面可用，并与 Create 中展示生成任务的 Generation Queue 明确分离。
- Studio 只在 Project + Version 上下文内出现。
- 当前先落地 Take Lanes：生成的方向可试听、对比，再明确提交为当前版本；Lyrics 草稿和 Stems
  分离也沿用这条闭环，真实音频渲染继续由服务端能力承接。

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
但不把这些能力全部提升为全局工具页：Reference 留在 Create/Library，Remix、Edit、Extend、Cover
回到当前 Version 的 Studio 上下文，Vocal Remover 回到 Stems，MV 放在 Finish/Publish。

完整能力归属、操作语义与打磨顺序见 [`MUSIC_CAPABILITIES.md`](./MUSIC_CAPABILITIES.md)。

## 三、Mori 的布局法则

### 桌面端

```text
固定 Rail        当前工作区                               固定底部 Player
品牌 / Create    Create、Project Overview 或 Studio       当前版本 / Transport / Queue
Workspace nav    内容随项目上下文变化                     跨页面保持
```

- Rail 是应用骨架，不是悬浮卡片；展开/收起不改变内容的语义位置。
- Create 的第一主操作只有一个：Smart 先 Review plan、Custom 直接 Generate；Queue 是当前任务的上下文入口。
- Studio 的工具和版本历史属于项目，不提升到全局 Rail。
- Player 使用独立的全宽 transport dock：左侧当前作品，中部 transport + progress，右侧
  音量和队列。
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
- 已落地第一版：Studio Take Lanes 支持试听、选择和明确提交当前版本；Lyrics 支持本地草稿保存、分段 AI Revision、
  多 Suggestion 对比以及 Apply / Undo；Stems 支持基于当前 Version 的二轨/最多十二轨自动分离计划、可选 MIDI、
  异步恢复/取消/重试，以及对真实返回资产的逐轨 Mute/Solo 本地 mix selection；可播放 stem renderer 尚待接入。
- 已落地第一版：Studio 的 Mori AI Changes 把 Add part、Replace section、Extend、Transform 放在
  Arrangement 时间线上下文中；时间线播放头与全局 Player 双向使用同一位置状态，并明确标记当前段落。
  用户可选择结构段或拖动起止控制形成 Custom range，再输入指令并复核 Change Plan；移动范围会让旧 Plan
  失效，最终结果进入 Take Lanes，当前版本不会被直接覆盖。
- 已落地第一版：从项目详情、Studio 或项目上下文中的 Rail 进入 Create 时保留 `project_ref`，
  生成命令不再意外落到预览项目；可用时先读取项目 projection 展示项目名称，读取失败保留中性上下文。
- 已落地第一版：Prompt 下方的 Creative sources 把 Audio、Voice、Inspiration 作为 Smart / Custom 共用的
  上下文输入，而不是继续堆全局 AI 工具。Audio 使用真实文件选择与格式/大小校验；Voice 使用稳定 preview
  `voice_ref`，与本次生成的人类可读 Vocal direction 分开；Inspiration 只提供少量策展起点并写入仍可编辑的
  Style。Library 的 All 视图已经将作品与素材分区，Sources 视图按 Audio / Voices / Inspiration 渐进筛选；
  `Use in Create` 会通过经校验的 provider-neutral source ref 恢复同一个创作上下文。当前素材为确定性 preview，
  正式资产引用与 projection 继续由 storage/music owner adapter 承接。
- 后续：Song Plan 的服务端版本历史、音频上传、连接真实音频渲染器、版本自动保存和更多导出格式。

## 五、明确不做的方向

- 不做纯聊天首页：聊天不能替代 Project、Version 和 Library 的对象关系。
- 不把所有 AI 能力塞入全局 Rail：工具应在当前 Project/Version 的上下文中出现。
- 不照搬 Suno、Tad、网易云的品牌颜色、文案或页面代码；只吸收已经验证的交互关系。
- 不在 Mori 前端绑定供应商私有字段；真实 provider 接入继续通过既有契约边界完成。
