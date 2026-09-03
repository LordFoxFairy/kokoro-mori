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
  [Advanced Stem Separation](https://help.suno.com/en/articles/6141313) 与
  [Suno Artist Update](https://help.suno.com/en/articles/8105281)。
- **Tad 值得吸收的部分**：把 Generate、Reference、Remix、Edit 作为清晰操作模型，同时提供
  Cover、Vocal Remover、MV 等能力。参考
  [Tad AI Music Generator](https://tad.ai/ai-music-generator)、
  [Vocal Remover](https://tad.ai/vocal-remover) 与
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
Output       默认 2 个 alternatives
Destination  Take Lanes
Commit       用户试听后显式 Use take
```

当前 Studio 已落地第一版 **Mori AI Changes**：可选择时间线段落，操作切换会沿用所选段落作为上下文；
自然语言指令、Change Plan 复核、非破坏式提示和 Generation 状态处于同一个工作面。用户点击
`Generate 2 takes` 后可看到进度、取消或重试；成功 Candidate 直接追加到 Take Lanes，但不会替换
Current Version。它不挤入全局 Rail，也不伪装成聊天记录。

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
- 下一步只需由 BFF / music owner adapter 实现已固定契约；浏览器不引入 provider 字段。

### P2 · 深度编辑

- 可拖选时间范围、播放头与段落联动。
- Lyrics 按段改写；Stem split、Add Vocal、Add Instrumental。
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
