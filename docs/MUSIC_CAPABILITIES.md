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
  -> Mix / Export / Publish
```

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
| 声音 | Stem / Mix | Studio · Stems | Separate、Add vocal、Add instrumental、Remove FX、Mute/Solo | Stem takes / Mix revision |
| 完成 | Export / Release | Studio / Project | Remaster、全曲/选区/多轨导出、封面；MV 后置 | Export / Publish artifact |
| 复用 | Asset | Library | Reference、Voice、Persona、Style preset | 可跨项目复用资产 |

### 全局 Rail 保持克制

全局只保留 Home、Create、Projects、Library。AI Cover、Vocal Remover、Remix、Edit、MV、TTS
不直接增加成永久导航项：

- Remix / Edit / Extend 属于当前 Version，在 Studio 中出现。
- Cover / Restyle 属于 Transform 的具体模式。
- Vocal Remover / Stem Split 属于 Stems。
- Voice / Persona / Reference 属于 Library 中的可复用资产。
- MV 属于 Finish / Publish，等歌曲完成后再出现。
- TTS 只有在形成明确的音乐创作 Job 时才进入，例如 spoken vocal 或 guide voice；不做孤立工具页。

这样既保留 Tad 的能力广度，又避免用户先理解一堆工具名才能开始创作。

## 3. Studio 的 AI 操作模型

Studio 只暴露四个稳定的一层意图，复杂参数进入下一层：

| 一层操作 | 用户心智 | 必要上下文 | 二层能力 |
|---|---|---|---|
| Add part | 在这里增加内容 | 插入点 / 邻近段落 | Instrument、Vocal、Harmony、Percussion、Texture |
| Replace section | 重做这一段 | 时间范围 | Arrangement、Lyrics、Melody、Instrumentation |
| Extend | 从这里继续 | 起始游标 | Continue、New outro、Loop variation |
| Transform | 保留核心，改变表达 | 当前 Version 或范围 | Restyle/Cover、Remaster、Vocal character、Intensity |

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
同一个工作面。Direction controls
允许用户明确锁定 Melody、Lyrics、Voice、Tempo、Structure，并选择 1 / 2 / 4 个 alternatives；Transform
还可在 Selected section 与 Whole song 之间切换。生成后可看到进度、取消或重试；成功 Candidate 直接追加到
Take Lanes，但不会替换 Current Version。它不挤入全局 Rail，也不伪装成聊天记录。

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

### Stems 的 AI 分离模型

Stems 吸收 Tad Vocal Remover 的两层选择，但不要求用户重新上传当前歌曲，也不做成全局工具页：

```text
Source       当前不可变 Version
Mode         Vocals + instrumental | Auto stems
Option       可选 MIDI transcription
Review       先确认输出数量、来源与结果去向
Run          snapshot / SSE 进度、取消、失败重试
Result       实际返回的 version-bound stem assets
Mix          Mute / Solo 先保存当前工作区的本地选择，renderer 接入后再驱动真实试听
```

`Vocals + instrumental` 是 Tad 式快速二轨工作流；`Auto stems` 吸收 Suno Auto Split，按音频内容检测
最多 12 个 vocals、drums、bass、guitar、keys、strings、wind、synth 等制作轨。两种模式都坚持
Suno Studio 的连续上下文：分离发生在当前 Version，
用户留在 Studio 内审阅结果，原版本保持不变。界面只展示 API 真正返回的资产，不用前端 fixture 冒充分离结果。

Suno 的 Split from Mix 与 Advanced Split 对 Mori 下一层能力有价值，但不提前摆出空控件：待 owner 能力协商
支持后，在同一个 Stems 工作面渐进增加 **Isolate one part**（目标音轨 + 其余混音）与 **Custom stems**
（选择多个目标乐器），不新增全局导航，也不把供应商套餐或乐器枚举泄漏进浏览器契约。

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
  instruction
  preserve                  melody | lyrics | vocal_identity | tempo | structure
  reference_asset_refs[]
  output_count              default 2, range 1–4
```

机器可检查的事实源位于
[`contract/openapi/mori-studio-change.v1.json`](../contract/openapi/mori-studio-change.v1.json)。
Generation snapshot 使用 `generation_kind: new_song | studio_change` 做显式判别；Studio 分支必须携带
`source_version_ref` 与 `operation`。这样刷新或断线恢复时，浏览器无需依赖内存态就能还原本次变更的来源和意图。
契约不携带 Suno、Tad 或其他 provider 私有字段。执行边界继续遵守：

- Command 使用 `Idempotency-Key` 和 request digest。
- 异步执行返回 `202`、稳定 job ref、状态与事件回放。
- Replace 必须有 range；Extend 必须有起点；Transform 必须有 source version。
- 输出只创建 Candidate/Take，不原地修改 Current Version。
- `Use take` 是独立、可审计、带并发版本条件的提交动作。

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
  mode              vocals_instrumental | auto_stems
  include_midi      boolean

StemSeparationSnapshot
  stem_separation_ref + version_ref
  mode + include_midi
  status + progress
  source_audio_digest
  stems[]           stem_ref + kind + label + audio/waveform asset refs + duration
  midi_asset_ref    optional
```

Command 使用 `Idempotency-Key`；恢复使用 durable snapshot 与 `Last-Event-ID`；取消是幂等 command。
公开契约不接受上传 URL、provider、tenant、subject 或 actor 字段，来源音频由 Version owner 解析。
机器事实源见
[`contract/openapi/mori-stem-separation.v1.json`](../contract/openapi/mori-stem-separation.v1.json)。

## 5. 打磨顺序

### P0 · 交互骨架（当前）

- Create：Smart / Custom、Song Plan review、Reference audio。
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
- 下一步只需由 BFF / music owner adapter 实现已固定契约；浏览器不引入 provider 字段。

### P2 · 深度编辑（进行中）

- 已完成可拖选时间范围、动态时间标尺、全局播放头与段落联动；Custom range 直接复用既有
  provider-neutral `time_range` 契约，调整范围后会使旧的 Review Plan 失效，避免错用过期选区。
- Lyrics 已完成按 Verse / Chorus / Whole lyrics 组织的 Rewrite、Continue、Find rhyme、Restructure
  界面闭环，并支持 Review、可编辑 Suggestion、Apply 与 Undo；Lyrics Revision contract、client、response parser、
  snapshot / SSE / cancel seam 已接入组件运行态，多候选保持独立且只应用用户选中的草稿。
- Stem split 已完成浏览器侧闭环：两种分离模式、可选 MIDI、Review、snapshot / SSE、取消、重试与实际资产；
  Mute/Solo 作为本地 mix selection 已就位，待可播放 stem renderer 接入后再驱动真实试听。已固定
  version-scoped OpenAPI、client、运行时 parser 与 contract tests。
- 定向 Isolate one part 与 Custom stems 等 owner 能力协商稳定后再进入渐进式高级选项。
- Add Vocal、Add Instrumental。
- Voice、Persona、Style preset、Reference 进入 Library assets。

### P3 · 完成与发布

- Remaster strength、mix revision、全曲/选区/多轨导出。
- Cover artwork 与发布信息。
- AI MV 作为完成歌曲的后置流程，不抢占创作主路径。

## 6. 体验门禁

- AI 操作在提交前必须可读、可改、可取消。
- 所有耗时任务必须显示状态、进度、失败与重试。
- 不出现无法解释结果去向的 Generate 按钮。
- 不把未渲染请求伪装成可播放音频。
- Player 跨页面保持；Generation Queue 与 Playback Queue 继续分离。
- 桌面保持浅色三层结构：全局 Rail、项目 Studio、全局 Player；移动端按优先级收敛而非等比缩小。
