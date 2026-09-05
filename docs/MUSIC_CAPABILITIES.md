# Mori 音乐能力模型 v0.1

> 目标：吸收 Suno 的“生成与制作连续工作流”和 Tad 的“AI 操作分类”，但不把 Mori 做成工具入口堆叠。

## 1. 产品判断

Mori 的核心不是“一句话生成一首歌”，而是这条可以长期使用的创作链：

```text
Idea / Reference
  -> 可检查的 Song Plan
  -> 多个 Candidate
  -> 用户选中的 Version
  -> 非破坏式 AI Change
  -> Take Lanes 对比
  -> Current Version
  -> Mix / Export / Release draft / Publish
```

> 交付优先级以 [`SUNO_PARITY.md`](./SUNO_PARITY.md) 为准：先完成 Suno 核心闭环的 P0.1 Durable Project
> Memory、P0.2 Creative Source Ingest、P0.3 Finish / Share / Publish；本文件第 5 节的 P0–P3 是能力分层与
> 既有浏览器实现分层，不改变当前推进顺序。

- **Suno 值得吸收的部分**：Create 与 Studio 连续、时间线范围成为 AI 上下文、生成结果进入
  Take Lanes、版本自动保留、分轨与导出都围绕当前作品发生。参考
  [Suno Studio](https://help.suno.com/en/articles/7940161)、
  [Studio 2.0](https://help.suno.com/en/articles/13670529)、
  [Take Lanes](https://help.suno.com/en/articles/13670913) 与
  [Advanced Stem Separation](https://help.suno.com/en/articles/12702337)。
- **Tad 值得吸收的部分**：把 Generate、Reference、Remix、Edit 作为清晰操作模型，同时提供
  Cover、Vocal Remover、MV 等能力。参考
  [Tad AI Music Generator](https://tad.ai/ai-music-generator)、
  [AI Audio Editor](https://tad.ai/audio-editor)、[Vocal Remover](https://tad.ai/vocal-remover) 与
  [AI Cover Generator](https://tad.ai/ai-cover-generator)。
- **Mori 的差异**：先显示 AI 将改哪里、改什么、产生几版，再执行；任何 AI 操作都不直接覆盖
  Current Version，结果统一进入 Take Lanes 供试听和提交。

## 2. 能力分层与界面归属

| 创作阶段 | 核心对象 | Mori 界面 | 用户能力 | 结果 |
|---|---|---|---|---|
| 起意 | Project / Song Plan | Create | Smart、Custom、Reference、Lyrics、Instrumental、Style、Voice、Duration | 可编辑 Song Plan |
| 探索 | Generation / Candidate | Create Queue / Project | 生成多个方向、取消、重试、A/B 试听 | Candidates |
| 编曲 | Version / Timeline range | Studio · Arrangement | Add part、Replace section、Extend、Transform | Take Lanes |
| 歌词 | Lyrics draft / Section | Studio · Lyrics | 续写、改写、押韵、结构调整、按段落应用 | Lyrics revision |
| 声音 | Stem / Mix | Studio · Voice & stems | Separate、Add vocal、Add instrumental、Remove FX、Mute/Solo | Stem takes / Mix revision |
| 完成 | Export / Release | Studio / Project | Remaster、全曲导出、Release artwork 与 draft；MV 后置 | Export / Release draft |
| 复用 | Asset | Library | Reference、Voice、Persona、Style preset | 可跨项目复用资产 |

### 全局 Rail 保持克制

全局只保留 Home、Create、Projects、Library。AI Cover、Vocal Remover、Remix、Edit、MV、TTS
不直接增加成永久导航项：

- Remix / Edit / Extend 属于当前 Version，在 Studio 中出现。
- 音乐 Cover / Restyle 属于 Transform 的具体模式；Release artwork 只负责视觉身份。
- Vocal Remover / Stem Split 属于 Stems。
- Voice / Persona / Reference 属于 Library 中的可复用资产。
- MV 属于 Finish / Release，等歌曲完成后再出现。
- TTS 只有在形成明确的音乐创作 Job 时才进入，例如 spoken vocal 或 guide voice；不做孤立工具页。

这样既保留 Tad 的能力广度，又避免用户先理解一堆工具名才能开始创作。

### Project Overview 的能力编排

Project Overview 不再把统计、候选和五张等权功能卡纵向堆成 dashboard。桌面端先展示可试听的 Latest directions，
再在同一工作区右侧给出绑定 Current Version 的任务列表；窄屏按“先听方向、再选任务”的顺序自然下排。任务名称直接写成
**Remix & edit、Cover、Lyrics、Voice & stems、Remaster & release**，同时标明 Arrangement、New takes、Review before apply、
Non-destructive 与 No auto-publish 等结果约束。Remix & edit 与 Cover 虽然都进入 Arrangement，但前者预选 Restyle，后者预选
Cover，并分别使用对应深链；这样吸收 Tad 的任务可辨识度，又保留 Suno 的同一 Version 连续制作上下文，入口仍然属于当前 Project / Version；
非 Current Candidate 的 `Set as current` 位于同一试听行：操作先以 Project-scoped CAS 发送 Candidate、Version 与
`expected_current_version_ref`，仅在 owner 精确确认后才更新 Current、`Open Studio` 与 Continue making；保存中旧 Current
继续可用，网络故障可重试，冲突要求刷新 Project。试听、选择或提交方向都不接管 Global Player。
Song Plan 保持独立事实区，Project 状态不再重复展示 Mood。

### Create 的创意来源模型

Create 首先把两个不同决策并列说清：**Approach** 决定 Smart（先复核 Song Plan）或 Custom（直接控制参数），
**Output** 决定 Song with lyrics 或 Instrumental。Output 在两种 Approach 中都持续可见，不再藏在 Custom 下拉框或
页面底部快捷按钮里。Smart 进入 Review 后，Idea 与 Creative sources 会让位给单一 Song Plan；`Back to idea`
恢复原输入，`Edit plan` 只修改本次结构化计划。Custom 则明确说明参数会直接进入 Generation Queue，不再错误暗示
仍会生成 Song Plan，也不在主卡下重复解释相同概念。Instrumental 只显示 Audio、Inspiration、Style、Duration 与编曲语义；Voice profile、Lyrics、
Vocal direction 会从界面和 Generation request 同时移除。由 Library 带入 Voice 时则自动回到 vocal output，避免素材
已经选中却被偏好设置静默忽略。

Create 不再把 Reference、Voice、Style 拆成互相重复的快捷按钮或全局工具页。主 Prompt 下方固定一层
轻量 **Creative sources**，Smart 与 Custom 共用同一份选择：

| 来源 | 用户意图 | 当前行为 | 契约事实 |
|---|---|---|---|
| Audio | “参考这段节奏、旋律或质感” | 选择、校验、替换或移除本地音频 | 上传完成后进入 `reference_asset_refs[]` |
| Voice | “沿用这个可复用的演唱身份” | 从渐进式 Voice profiles 中选择 | 稳定资产引用进入 `voice_ref` |
| Inspiration | “从一个完整创作方向开始” | 选择少量策展预设并把结果写入可编辑 Style | 当前进入 provider-neutral `style` 文本 |

Voice profile 与 **Vocal direction** 必须分开：前者是可复用资产身份，后者是本次作品的演唱要求，例如
“close and unhurried”。Mori 不把 `Natural lead` 这类展示文案伪装成 `voice_ref`。Inspiration 也只是起点；
用户一旦手动修改 Style，就解除预设关联，避免界面仍声称使用一个已经不准确的 preset。

这一层吸收 Suno 在 Create 中把 Audio、Voice、Inspo 放在创作上下文里的做法，也吸收 Tad 对 Reference
输入的明确分类；但只展示少量策展方向，避免把 Tad 的大规模标签树直接复制进首屏。Library 已用同一套
Audio / Voice / Inspiration 语义建立可复用素材层：默认 All 视图将可播放 Version 与素材分区，Sources 视图再渐进展开
类型筛选；Project 只留在独立的 Projects 工作区，不作为 Library 筛选或重复行。Version 与 Creative Source 使用独立的
cursor feed，避免一个 Version 页把 Source 挤出首屏；`Use in Create` 只传递 provider-neutral 的 `source_kind` 与
`source_ref`，Library 通过 `next_cursor` 渐进加载更多来源并支持单页重试，Create 再通过 source detail projection 恢复不在第一页的来源。
当前使用确定性 preview assets，正式资产接线后位置、层级和交互保持不变。参考 Suno 的
[Studio Library](https://help.suno.com/en/articles/13670849)、[Voices](https://help.suno.com/en/articles/11362369)
和 [Audio Uploads](https://help.suno.com/en/articles/6141569)。

## 3. Studio 的 AI 操作模型

Studio 只暴露四个稳定的一层意图，复杂参数进入下一层：

| 一层操作 | 用户心智 | 必要上下文 | 二层能力 |
|---|---|---|---|
| Add part | 在这里增加内容 | 插入点 / 邻近段落 | Instrument、Vocal、Harmony、Percussion、Texture |
| Replace section | 重做这一段 | 时间范围 | Arrangement、Lyrics、Melody、Instrumentation |
| Extend | 从这里继续 | 起始游标 | Continue、New outro、Loop variation |
| Transform | 保留核心，改变表达 | 当前 Version 或范围 | Restyle、Cover；Finish 通过同一 transport 承接 Remaster |

每次操作必须明确显示：

```text
Source       当前 Version
Scope        时间范围、插入点或整首
Instruction  用户自然语言要求
Constraints  保留旋律/歌词/声音等约束
Output       用户选择 1 / 2 / 4 个 alternatives，默认 2 个
Destination  Take Lanes
Commit       用户试听后显式 Use take
```

当前 Studio 已落地第一版 **Mori AI Changes**：时间线播放头与全局 Player 使用同一位置状态，并实时标记所在段落；
用户既可选择结构段，也可拖动起止控制形成精确的 Custom range，范围会直接成为 Replace/Transform 的毫秒级
`time_range`，Add/Extend 则使用其终点。自然语言指令、Change Plan 复核、非破坏式提示和 Generation 状态处于
同一个工作面。Add part、Replace section、Extend、Restyle 与两种 Cover 现在各自提供少量 prompt starter；
starter 只填入可编辑指令，不创建任务，也不绕过 Change Plan。Direction controls
允许用户明确锁定 Melody、Lyrics、Voice、Tempo、Structure，并选择 1 / 2 / 4 个 alternatives；Transform
不再展示一组含义模糊的高级参数，而是先让用户选择 Restyle 或 Cover。生成后可看到进度、取消或重试；成功
Candidate 直接追加到 Take Lanes，但不会替换 Current Version。它不挤入全局 Rail，也不伪装成聊天记录。

Take Lanes 中的 **Open Version、Playing、Selected Take、Current Version** 是四个独立状态。`Use take` 不再是
前端本地切换：它通过 Project-scoped、带幂等键和期望旧 Current 的 compare-and-set 命令提交。等待期间旧 Current
继续保持；成功响应必须精确确认 Project、Candidate、Version 与 previous Current，界面才更新 Project Current 并
打开该 Take。瞬时失败保留原 Current 和 Retry，重试复用原幂等键；并发冲突要求刷新，不用旧页面覆盖新选择。
Create 的 Generation Queue 与 Project Overview 中的 `Set as current` 复用完全相同的命令和确认规则；进入既有 Project 时先读取其
`current_version_ref` 作为并发条件。Queue 与 Studio 因此只是同一作品提交能力的两个界面，不再出现 Queue 看似成功、
刷新后却回到旧 Current 的前端假状态。

Version history 继续属于 Project / Studio，而不是全局工具：大于 1360px 时作为第三栏持续可见；画布更窄时由
Studio 顶部 Versions 动作打开右侧抽屉，移动端使用全宽工作表。常驻栏与抽屉共享同一 Version 列表和状态规则，
`aria-current` 只表达当前打开的 Version，Current 标签只来自 Project 确认值；打开历史不会暂停 Global Player，
抽屉则位于 Player 上方并完整管理焦点与背景滚动。

### Transform / Restyle / Cover 的意图模型

这层同时吸收 Suno 的 Version 连续性和 Tad 的命名能力分类：入口仍在当前 Version 的 Arrangement 中，但用户
先看到明确任务名，再只填写该任务需要的内容。

```text
Restyle
  Source       Open Version
  Scope        Selected section | Whole song
  Direction    Genre / texture / performance instruction
  Protected    用户选择 Melody / Lyrics / Voice / Tempo / Structure
  References   0–8 个已有素材引用
  Result       1 / 2 / 4 个 Takes

Cover
  Source       Open Version，不重新上传
  Scope        Whole song
  Mode         Vocal | Instrumental
  Voice        Vocal 可选；Instrumental 固定为空
  Protected    Vocal = Melody + Lyrics + Structure
               Instrumental = Melody + Structure
  References   固定为空
  Result       固定 2 个 Takes
```

Cover 卡片与 Review Plan 明确写出 **Audio cover, not release artwork**；Release artwork 仍只存在于 Finish / Release。
两种意图都会先形成可读 Change Plan，任何 scope、instruction、anchors、references、output、mode 或 Voice 与
返回 snapshot 不一致时，整批结果拒绝挂接。这样命名能力不会演变成 Tad 式全局工具堆，也不会破坏 Suno 式
“从当前作品继续做”的连续感。

### Finish / Remaster 的 AI 完成模型

Remaster 不是 Arrangement 中自由 Transform 的另一个参数，也不是全局工具。它作为 Studio 顶部的 **Finish**
动作出现：用户已经选定作品方向后，用最短路径完成制作层精修。

```text
Source       Open Version | Latest saved Mix Revision
Strength     Subtle | Balanced | Bold
Scope        Whole song
Protected    Melody + Lyrics + Vocal identity + Tempo + Structure
Review       执行前确认完整计划
Result       固定 2 个 Remastered Takes
Commit       对比后显式 Use take；源与 Current 均不改变
```

Finish 与独立 Export 使用同一套来源心智：**Open version** 显示歌曲名、时长与是否包含已保存 mixer choices，
**Mix Revision** 显示用户命名、修订号和轨道数。界面不展示 `version_ref`、`mix_revision_ref` 等内部引用；
引用只留在命令与结果核对边界。这样用户只需判断“原始版本还是已保存混音”，不必理解系统标识符。

这个层级吸收 Suno Remaster 的“保持作品身份、用强度控制制作变化”，以及 Tad 把 AI 能力意图说清楚的优点；
但 Mori 把来源、约束和结果去向全部结构化。运行中关闭 Finish 不会取消任务，重新打开可恢复进度；snapshot 的
source 或 strength 与 Review Plan 不一致时不会挂接任何 Candidate。保存过 Mix 时默认选择最新 Mix Revision，
否则默认当前 Version，避免用户刚完成的 Gain / Mute 调整在精修时悄悄丢失。

### Finish / Release 的完成信息模型

Release 与 Remaster 共用 Studio 的 Finish 入口。Release 先保存当前 Version 的发布意图，再通过独立 Publish command 完成发布：

```text
Identity     Title + Description + Artwork
Visibility   Private（默认） | Link only | Public
Permissions  Allow remixes（与 Visibility 独立）
Disclosure   Explicit content
Persistence  Save release draft + expected revision
 Publish      Draft revision 确认后显式 Publish / Unpublish
```

Artwork 是视觉身份，不等于 Tad 所称的音乐 Cover。用户可以沿用当前图片，或输入 brief，选择
Abstract / Editorial / Illustrated / Photographic 与 Warm dawn / Violet night / Mint haze / Monochrome，先 Review
固定的 **1:1、no text、4 concepts** 计划，再启动独立的异步 Artwork Generation。任务支持 snapshot、SSE、取消、
失败重试和关闭窗口后的恢复；只有 Version、prompt、style、palette 与固定约束完整匹配的成功结果才可选择。
图片候选通过 opaque image asset ref 展示，选中后写入 Release draft，从不进入音频 Take Lanes。

这使 Mori 同时保留 Suno 的作品连续性和 Tad 清晰的意图标签：用户始终知道自己是在“精修音频”“准备发布信息”
还是“做音乐 Cover / Restyle”。Private 是安全且可预测的默认值；Link only / Public 不会自动开启 Remix，
Allow remixes 也不会改变可见性。保存草稿不会发布、分享或替换 Current Version。

产品反馈也必须服从同一事实边界：Create 的未保存输入没有可分享资源，因此不显示 Share；Studio 的 `Copy link`
只是复制当前 Project + Version 深链，等待剪贴板写入成功后才显示 `Link copied`，权限拒绝时明确显示失败并允许重试。
它不代表作品已经发布，也不会改变 Release draft 的可见性。

### Lyrics 的 AI 协作模型

Lyrics 不再只是一个孤立 textarea，也不复制 Tad 的工具入口列表。当前界面把可保存的歌词 Draft 与
**Mori lyric partner** 放在同一个工作面：

```text
Direction    Rewrite | Continue | Find rhyme | Restructure
Scope        Verse | Chorus | Whole lyrics
Instruction  用户自然语言意图
Review       先确认 Direction、Scope 与保留 Meaning/Cadence
Suggestion   独立、可编辑，不立即覆盖 Draft
Commit       Apply to draft；应用后仍可 Undo，最终由 Save draft 持久化
```

这一交互吸收 Suno 的“选区修改 → 产生候选 → 用户确认”与 Tad 的“定向改词、保持声线/节奏连续性”，但
保持 Mori 的非破坏式原则：原稿在 Apply 前不变，建议文本本身也可继续编辑。工作面已接入 version-scoped
Lyrics Revision seam：一次请求默认返回两个可切换 Suggestion，运行中展示 snapshot / SSE 进度并允许取消，
失败时保留已复核方向供重试；BFF 未接通时明确显示离线状态，不在组件内伪造歌词结果。

Lyrics Draft 的保存与 AI Revision 分开：AI Revision 只给出可选择、可编辑的建议，`Save draft` 才会创建
Version-bound、不可变的 Workspace revision。浏览器不得把 localStorage 当作 Draft 事实；显式 Studio URL 优先于
历史 Open Version，确认 Open Version 后才允许写入。保存时锁定词稿与 Apply / Undo；只有返回的完整 projection
精确匹配输入和下一 revision 后才显示 `Saved`。临时网络失败保留原命令和 `Idempotency-Key`，冲突要求 Refresh。
若用户带着未保存文字打开另一 Version，必须显式选择 Keep editing、Discard & open 或 Save & open；后者只在
owner 确认新 revision 后完成跳转。preview 词稿可以编辑，但不可显示为已保存或跨设备可恢复。

### Voice & Stems 的图层工作流

Add Vocals、Add Instrumental 与 Separate mix 统一留在当前 Version 的 **Voice & stems** 工作面，不复制 Tad
把每一种能力都提升成全局工具页的做法。用户先选择意图，再只看到该任务真正需要的输入：

```text
Add Vocals
  Lyrics       必填
  Voice        可选的稳定 voice_ref，与 Vocal direction 分离
  Direction    本次演唱要求
  Scope        Whole song
  Keep         Melody + Tempo + Structure

Add Instrumental
  Direction    编曲与留白要求
  Scope        Whole song
  Keep         Melody + Lyrics + Voice + Tempo + Structure
```

两条路径都先 Review Layer Plan，默认生成两个 alternatives，并复用 Studio Change 的 Generation lifecycle；
成功结果进入 Arrangement 的 Take Lanes，用户明确 `Use take` 前不替换 Current Version。切换 Add Vocals、
Add Instrumental 与 Separate mix 时，本地未提交草稿不会丢失；运行中的图层在离开并返回 Stems 后仍恢复到原意图，
保留取消和重试入口。进入 Review 后输入表单会让位于单一 Layer Plan，`Edit request` 再恢复原草稿，避免请求与复核
同时堆在一个长页面里。该层级吸收 [Suno Add Vocals](https://help.suno.com/en/articles/6882817)
的“歌词 + 声音身份 + 当前伴奏”关系，以及 [Suno Studio 2.0](https://help.suno.com/en/articles/13670529)
在作品内创建 vocals / instruments 的连续工作流；但 Mori 使用结构化、provider-neutral 请求，不让自然语言承担关键类型判断。

在契约中，两者仍属于稳定一层操作 `add_part`：时间线内容使用 `insertion_point`，整首图层使用
`whole_version + part_kind`。这样不会为了两个入口再创建新的任务状态机或顶层 operation。

### Stems 的 AI 分离模型

Stems 吸收 Tad Stem Splitter 的“来源 → 模式 → 结果”短路径，但不要求用户重新上传当前歌曲，也不做成全局工具页：

```text
Source       当前不可变 Version
Mode         Vocals or one part | Full stem split | Choose parts
Targets      1 个 | 自动检测 | 2–10 个
Option       可选 MIDI transcription
Review       先确认输出数量、来源与结果去向
Run          snapshot / SSE 进度、取消、失败重试
Result       实际返回的 version-bound stem assets
Audition     一个同步 Transport + Seek；逐轨 Mute / Solo / Level
Save         完整 Gain / Mute → 不可变 Mix Revision；Solo 不持久化
Export       每个返回音轨可独立下载
```

`Vocals or one part` 是默认快路径：默认直接说明会得到 Vocals + Instrumental，也可改选 drums / bass 等目标，
得到目标与不含该目标的 mix；`Full stem split` 按内容检测最多 12 个制作轨；`Choose parts` 让用户从十个稳定的 Mori
音轨类别中选择 2–10 个目标。界面名称面向用户，契约仍保持 `isolate_part | auto_stems | custom_stems`，不因文案
升级破坏 provider-neutral 协议。
三者吸收 [Suno Advanced Stem Separation](https://help.suno.com/en/articles/12702337) 当前的 Split from Mix、
Auto Split、Advanced Split 意图层级，但使用 Mori 自己的名称和 provider-neutral `target_kinds`，不泄漏套餐、
credits 或供应商的近百个乐器 ID。它们都坚持 Suno Studio 的连续上下文：分离发生在当前 Version，用户留在
Studio 内 Review，原版本保持不变。成功后只展示 API 真正返回的 version-bound assets，不用前端 fixture 冒充结果。
Stem mixer 以第一条返回音轨为时钟，在播放和 seek 前对齐全部通道，并在漂移超过阈值时重新同步；Mute、Solo、
Level 会立即改变 audition 通道，任一媒体失败则停止整组并显示真实失败。开始分轨试听会暂停全局 Player；全局
Player 再次开始时也会暂停 mixer，避免两套声音竞争。逐轨 Download 与试听都使用同一个受信同源媒体 seam，
不会把 Storage 或 provider URL 暴露给浏览器。用户明确保存时，完整逐轨 Gain / Mute 被写入新的不可变
Mix Revision；未改动的状态不会重复保存，继续调整后则创建下一 revision。Solo 只用于快速监听，永不进入持久化请求。

## 4. Studio Change API 契约

Studio Change 继续创建既有 **Generation** 资源，不再增加一套 Change Job 状态机：

```http
POST /api/v1/mori/versions/{version_ref}/generations  → 202
GET  /api/v1/mori/generations/{generation_ref}
GET  /api/v1/mori/generations/{generation_ref}/events
POST /api/v1/mori/generations/{generation_ref}/cancel
```

Create 从 Project 发起 Generation，Studio 从不可变 Version 发起 Generation；两者最终都输出
Candidate 并进入 Take Lanes。浏览器仍只调用同源 BFF。Studio 请求的 provider-neutral 结构为：

```text
StudioChangeGenerationInput
  operation                 add_part | replace_section | extend | transform
  scope
    insertion_point         position_ms
    time_range              start_ms + end_ms
    from_position           position_ms
    whole_version
  add_part whole_version
    part_kind               vocals | instrumental
    lyrics                  vocals 必填；instrumental 为 null
    voice_ref               vocals 可选；instrumental 为 null
  transform restyle
    intent                  restyle
    scope                   time_range | whole_version
    instruction             必填
    preserve                用户选择的稳定 anchors
    reference_asset_refs[]  0–8
    output_count            1 | 2 | 4
  transform cover
    intent                  cover
    scope                   whole_version
    cover_mode              vocal | instrumental
    voice_ref               vocal 可选；instrumental 为 null
    preserve                vocal 固定 melody + lyrics + structure
                            instrumental 固定 melody + structure
    reference_asset_refs[]  固定为空
    output_count            fixed 2
  transform remaster
    intent                  remaster
    source                  version | mix_revision(mix_revision_ref)
    variation_strength      subtle | balanced | bold
    scope                   whole_version
    preserve                melody + lyrics + vocal_identity + tempo + structure
    output_count            fixed 2
  instruction
  preserve                  melody | lyrics | vocal_identity | tempo | structure
  reference_asset_refs[]
  output_count              default 2, range 1–4
```

机器可检查的事实源位于
[`contract/openapi/mori-studio-change.v1.json`](../contract/openapi/mori-studio-change.v1.json)。
Generation snapshot 使用 `generation_kind: new_song | studio_change` 做显式判别；Studio 分支必须携带
`source_version_ref` 与 `operation`。Restyle / Cover 分支继续回显完整 reviewed context，Cover 额外回显 mode 与
Voice；浏览器逐字段匹配后才接收 Candidate。这样刷新或断线恢复时，无需依赖内存态就能还原本次变更的来源和意图。
契约不携带 Suno、Tad 或其他 provider 私有字段。执行边界继续遵守：

- Command 使用 `Idempotency-Key` 和 request digest。
- 异步执行返回 `202`、稳定 job ref、状态与事件回放。
- Replace 必须有 range；Extend 必须有起点；Transform 必须有 source version。
- Add part 的时间线插入必须有 insertion point；整首图层必须有 `part_kind`，Vocal layer 必须有歌词。
- 输出只创建 Candidate/Take，不原地修改 Current Version。
- `Use take` 是独立、可审计、带并发版本条件的提交动作。

### Current Version Commit API

Take 的提交是 Project 事实，不依附当前浏览器选择，也不复用异步 Generation 状态机：

```http
PUT /api/v1/mori/projects/{project_ref}/current_version
Idempotency-Key: <opaque command identity>
```

```text
CurrentVersionInput
  candidate_ref
  version_ref
  expected_current_version_ref   MoriRef | null

CurrentVersionSelection
  project_ref
  current_version_ref
  source_candidate_ref
  previous_version_ref
  selected_at
```

owner 原子验证 Project/Candidate/Version 关系与 expected Current；旧值不匹配返回 `409 current_version_conflict`，
关系不成立返回 `422`。消费者只在响应与完整命令上下文一致时更新 Current；网络不确定时使用同一幂等键重放，
不生成第二次选择。机器事实源见
[`contract/openapi/mori-current-version.v1.json`](../contract/openapi/mori-current-version.v1.json)。

### Project Workspace Memory API

Project 的 Current Version、用户的 Open Version、Song Plan 与 Lyrics Draft 不能靠浏览器内存或 localStorage
拼成“看似保存”的状态。P0.1 使用一个 BFF-composed、browser-private projection 让 Studio 与 Project Overview
从同一份已确认的工作区恢复：

```http
GET /api/v1/mori/projects/{project_ref}/workspace
PUT /api/v1/mori/projects/{project_ref}/song_plan
PUT /api/v1/mori/versions/{version_ref}/lyrics_draft
PUT /api/v1/mori/projects/{project_ref}/workspace/open_version
Idempotency-Key: <opaque command identity>   # 每个 PUT
```

```text
ProjectWorkspaceProjection
  project.current_version_ref       Project 共享事实；不因打开 Studio 而改变
  current_song_plan                 当前不可变 Song Plan revision 或 null
  open_version                      当前用户的 Project 内 Open Version 偏好或 null
  latest_lyrics_draft               仅属于 open_version 的不可变 Draft revision 或 null
  latest_mix_revision               仅摘要，不携带音轨资产
  active_tasks[]                    generation / lyrics_revision / stem_separation / artwork_generation / export
  revision_cursor + observed_at     恢复时使用的 opaque 观察位置
```

Song Plan、Lyrics Draft 与 Open Version 各自带自己的 `expected_revision`，成功后均返回完整的 reconciled
`ProjectWorkspaceProjection`。浏览器精确核对 Project / Version、输入内容与下一 revision 后才显示 `Saved`；临时
网络失败保留原 command 和原 `Idempotency-Key` 重试，`409` 则保留用户文字并要求刷新/rebase。显式 Studio URL
优先于保存的 Open Version；Open、Playing、Selected 与 Current 永远不合并。机器事实源见
[`contract/openapi/mori-project-workspace.v1.json`](../contract/openapi/mori-project-workspace.v1.json)。

当前 live Project 的浏览器接入顺序固定为：Create Smart 读取 Workspace → 保存用户确认的 Song Plan → 创建 Generation；本地
preview Project 仅保留 legacy Song Plan POST 演示分支。Studio 再将 URL 指定的 Version 作为 Open Version 精确确认 → 打开该
Version 的 Lyrics Draft → 执行 owner-confirmed 保存。Studio 顶栏只展示当前 Workspace command 的 Saving / Saved / Retry；
任何新的未保存编辑都会覆盖旧的 `Saved` 提示。Save 响应先进入 projection context check，旧 Project / Version 的
迟到响应不得改变当前编辑面。这样即使用户在多个 Studio 窗口间切换，也不会把歌词写到另一个 Version 或由旧响应覆盖。

### Lyrics Revision API

歌词建议输出文本，不输出音频 Candidate，因此不把它伪装成 Studio Generation。浏览器侧单独固定以下异步资源：

```http
POST /api/v1/mori/versions/{version_ref}/lyrics_revisions  → 202
GET  /api/v1/mori/lyrics_revisions/{lyrics_revision_ref}
GET  /api/v1/mori/lyrics_revisions/{lyrics_revision_ref}/events
POST /api/v1/mori/lyrics_revisions/{lyrics_revision_ref}/cancel
```

```text
LyricsRevisionInput
  direction        rewrite | continue | rhyme | restructure
  scope            section(section_label + start_line + end_line + source_text) | whole_lyrics(source_text)
                   line range 相对归一化 lyrics_context，0-based、左闭右开
  instruction
  lyrics_context   当前完整 Draft，包含 scope source_text
  constraints      meaning | cadence | rhyme_scheme | section_length
  output_count     1–4，默认 2

LyricsRevisionSnapshot
  version_ref + direction + scope
  instruction + constraints + output_count
  status + progress
  source_digest
  suggestions[]    suggestion_ref + text
```

`source_digest` 是服务端生成的 opaque concurrency token，将结果绑定到提交时的 Draft；后续 commit
需把它作为预期版本交回 owner，若原稿已经变化，Apply 必须要求用户重新确认，不能静默覆盖。Snapshot 同时回显
instruction、constraints 与 output_count，刷新后不依赖临时表单恢复意图。Command 使用 `Idempotency-Key`，
恢复使用 durable snapshot + `Last-Event-ID`，公开字段保持
`snake_case` 且不携带 caller-supplied identity 或 provider 参数。机器事实源见
[`contract/openapi/mori-lyrics-revision.v1.json`](../contract/openapi/mori-lyrics-revision.v1.json)。

### Stem Separation API

音轨分离从不可变 Version 创建独立的异步资源，不与生成 Candidate 或歌词 Suggestion 混用：

```http
POST /api/v1/mori/versions/{version_ref}/stem_separations  → 202
GET  /api/v1/mori/stem_separations/{stem_separation_ref}
GET  /api/v1/mori/stem_separations/{stem_separation_ref}/events
POST /api/v1/mori/stem_separations/{stem_separation_ref}/cancel
```

```text
StemSeparationInput
  mode              isolate_part | auto_stems | custom_stems
  target_kinds[]    isolate=1；auto=0；custom=2–10，唯一
  include_midi      boolean

StemSeparationSnapshot
  stem_separation_ref + version_ref
  mode + target_kinds[] + include_midi
  status + progress
  source_audio_digest
  stems[]           stem_ref + kind + label + audio/waveform asset refs + duration
  midi_asset_ref    optional
```

Command 使用 `Idempotency-Key`；恢复使用 durable snapshot 与 `Last-Event-ID`；取消是幂等 command。
公开契约不接受上传 URL、provider、tenant、subject 或 actor 字段，来源音频由 Version owner 解析。
机器事实源见
[`contract/openapi/mori-stem-separation.v1.json`](../contract/openapi/mori-stem-separation.v1.json)。

### Mix Revision API

Mix Revision 保存混音元数据，不执行音频渲染，因此使用同步 `201` command 与可读取的不可变资源：

```http
POST /api/v1/mori/versions/{version_ref}/mix_revisions  → 201
GET  /api/v1/mori/mix_revisions/{mix_revision_ref}
```

```text
MixRevisionInput
  source_stem_separation_ref
  name                1–120 字符
  tracks[]            1–12；stem_ref + gain(0–1) + muted

MixRevision
  mix_revision_ref + version_ref + revision
  source_stem_separation_ref + name + tracks[]
  created_at
```

owner 必须验证 separation 属于路径 Version，并要求请求中的 stem 集合与完成的 separation 精确一致。
Command 使用 `Idempotency-Key`；相同内容没有变化时浏览器禁用重复提交，任一 Gain / Mute / Name 改动后再次保存
创建新的 revision。Solo 是监听状态，不属于 durable contract。机器事实源见
[`contract/openapi/mori-mix-revision.v1.json`](../contract/openapi/mori-mix-revision.v1.json)。

### Media Access API

Stem snapshot 继续只保存稳定的 opaque `audio_asset_ref`。浏览器通过独立、只读的同源媒体投影访问字节：

```http
GET /api/v1/mori/assets/{asset_ref}/content
Range: bytes=START-END
If-Range: ETAG
```

`disposition=inline` 用于播放，`disposition=attachment` 用于明确下载；完整响应为 `200`，seek/resume 为 `206`。
BFF 必须按受信会话校验该 asset 与用户可见 Mori 资源的关联，再调用 Storage owner；浏览器既不传 identity，
也不接收 bucket、object key 或 provider signed URL。机器事实源见
[`contract/openapi/mori-media-access.v1.json`](../contract/openapi/mori-media-access.v1.json)。

## 5. 打磨顺序

### P0 · 交互骨架（当前）

- Create：Smart / Custom、Song Plan review、Audio / Voice / Inspiration 创意来源。
- Studio：Arrangement / Lyrics / Stems、Mori AI Changes、Take Lanes。
- 全局：Player、播放队列、Project-first 导航。

### P1 · Studio Change 契约（已完成浏览器侧）

- 已固定四种 operation、scope 和 preserve 语义。
- 已增加 machine-readable OpenAPI、浏览器 request builder、同源 client、运行时 response parser 和 contract tests。
- 新歌与 Studio Change 共用 Generation lifecycle，并通过 discriminated snapshot 支持刷新恢复。
- Studio 已接入这一浏览器 seam：基于时间线段落计算毫秒 scope，跟踪 snapshot / SSE replay，支持取消、重试，
  并把成功 Candidate 非破坏式追加到 Take Lanes。
- Direction controls 已把 API 中的 `preserve`、`output_count` 与 Transform `whole_version` scope 变成用户可见、
  可复核的控制项；默认工作面仍保持收起，避免把 Studio 做成参数面板。
- Mori AI 输入已加入 operation-aware prompt starters：既降低空白输入成本，也保持自然语言可编辑、计划先复核、
  用户再显式生成的控制边界。
- Transform 已拆成 Restyle / Cover 两个可读意图：Restyle 保留选区、anchors、references 与 1 / 2 / 4 Takes；
  Cover 固定使用 open Version、Whole song、两条 Take，并按 Vocal / Instrumental 锁定 Voice 和保护项。两者都先
  Review，并通过精确 snapshot 匹配后进入 Take Lanes。
- Take Lanes 的 `Use take` 已接入独立 Current Version command：非乐观提交、CAS 冲突、精确响应核对、失败保留
  旧 Current、可重试故障复用幂等键；Version history 从 Project 确认的 Current 派生，不再按列表顺序猜测。
- Version history 已完成响应式连续性：宽屏保留项目第三栏，1280px 与移动端通过 Studio header 抽屉访问；
  常驻栏和抽屉复用状态行，Open 与 Current 不合并，缩窄布局不会让历史入口消失。
- 下一步只需由 BFF / music owner adapter 实现已固定契约；浏览器不引入 provider 字段。

### P2 · 深度编辑（进行中）

Composition 的第一组 provider-neutral 纯函数已落地到 `composition.ts`：Move、Trim、Split、Fade 只改变本地 Track / Clip / Placement；`composition-command.ts` 已固定 revisioned command 的 snake_case 输入边界，`composition-history.ts` 提供本地 Undo / Redo 历史，但尚未宣称已持久化
投影，不直接写 owner 数据；后续接入 revisioned Composition command 前，UI 不展示“已保存”状态。

- 已完成可拖选时间范围、动态时间标尺、全局播放头与段落联动；Custom range 直接复用既有
  provider-neutral `time_range` 契约，调整范围后会使旧的 Review Plan 失效，避免错用过期选区。
- Lyrics 已完成按 Verse / Chorus / Whole lyrics 组织的 Rewrite、Continue、Find rhyme、Restructure
  界面闭环，并支持 Review、可编辑 Suggestion、Apply 与 Undo；Lyrics Revision contract、client、response parser、
  snapshot / SSE / cancel seam 已接入组件运行态，多候选保持独立且只应用用户选中的草稿。
- Stem split 已完成浏览器侧闭环：Vocals or one part、Full stem split、Choose parts、可选 MIDI、Review、snapshot / SSE、
  取消、重试与实际资产。成功结果已接入同步 Transport、Seek、逐轨 Mute / Solo / Level 与单轨下载；媒体通过
  同源、支持 Range 的 asset content seam 读取，失败不回退到假音频。Gain / Mute 现可明确保存为不可变
  Mix Revision，保存失败保留当前调整，未变化时不重复创建；Solo 保持 preview-only。
- Add Vocal、Add Instrumental 已落地为 Stems 内的 whole-Version `add_part` 图层工作流：意图选择、结构化输入、
  单步 Review、进度/取消/重试与 Take Lanes 去向均复用既有 Generation lifecycle，不新增全局工具或第二套任务状态机。
- Create 已建立 Audio / Voice / Inspiration 的统一选择位，并把 `voice_ref` 与 Vocal direction 分离；Library
  已加入同源 preview 素材架、类型筛选、搜索和 `Use in Create` 上下文恢复。下一步由 storage/music owner
  adapter 提供正式 Audio、Voice、Persona、Style preset 与 Reference projection，替换当前 preview 目录。

### P3 · 完成与发布

- 已完成浏览器侧第一刀：显式选择 Studio 当前打开的 Version / 最新 Mix Revision、Full song、MP3/WAV；异步 render snapshot
  回显完整 Project/Version/source/scope/format 上下文，创建不确定时复用幂等键，瞬时读取失败继续跟踪原任务，失败保留选择，
  成功后下载。关闭窗口后顶栏仍持续显示 Exporting / Ready / Needs attention，移动端以加载、成功、失败图标保留反馈；
  界面只呈现真实已发布能力，不放选区/多轨死入口。
- 已完成浏览器侧第二刀：Studio 顶部 Finish 提供 Version / 最新 Mix Revision 来源与 Subtle / Balanced / Bold
  Remaster strength；先 Review 再复用 typed `transform + intent: remaster` Generation，snapshot 严格回显来源与强度，
  结果固定为两个非破坏式 Takes。关闭窗口不丢运行态，也不自动替换 Current。
- 已完成浏览器侧第三刀：Finish 的 Release 页签保存 version-scoped draft，Private 默认、Visibility / Remix 权限独立；保存确认后提供独立 Publish / Unpublish command。Artwork 可沿用当前图，或通过固定 1:1、无文字、四候选的异步流程生成和选择。Artwork
  只进入 Release draft，不进入音频 Take Lanes；窗口关闭、页签切换与任务恢复保持上下文，切换 Version 会清理旧草稿。
- 已完成浏览器侧第四刀：Studio Transform 中的 Restyle / Cover 使用命名意图和严格 typed snapshot；Cover 与
  Release artwork 完全分离，Vocal / Instrumental 模式只暴露必要控制，结果保持非破坏式。
- 已完成浏览器侧第五刀：Finish 与 Export 的来源卡统一显示歌曲名、时长、保存的混音名称和轨道数，不再把 opaque
  Version ref 当作用户信息；Remaster、Release draft 与文件导出的职责仍保持分离。
- 已完成浏览器侧第六刀：Create 移除没有持久化分享对象的 Share；Studio 将深链动作明确命名为 Copy link，
  以 pending / success / failure 状态反映真实 Clipboard 结果，失败可再次点击重试，不提前宣称成功。
- 下一步：选区/多轨渲染；等待真实多轨 artifact contract 后再开放。Release Publish 的真实 owner integration smoke 仍待 BFF / Storage 接通。
- AI MV 作为完成歌曲的后置流程，不抢占创作主路径。

## 6. 体验门禁

- AI 操作在提交前必须可读、可改、可取消。
- 所有耗时任务必须显示状态、进度、失败与重试。
- 不出现无法解释结果去向的 Generate 按钮。
- 不把未渲染请求伪装成可播放音频。
- Player 跨页面保持；Generation Queue 与 Playback Queue 继续分离。
- 桌面保持浅色三层结构：全局 Rail、项目 Studio、全局 Player；移动端按优先级收敛而非等比缩小。
- 移动端 Rail 采用真正的导航抽屉语义：打开后锁定背景滚动、焦点进入并循环在 Rail 内，内容与 Player 使用 inert 隔离，Escape、遮罩和目的地选择关闭后回到触发入口；品牌行使用音乐波形图形，不再把孤立字母当作 Logo。
- Version history 在所有宽度都必须可达，但始终停留在 Project / Studio 上下文；抽屉覆盖 Player，不挤压或替代 Player。
