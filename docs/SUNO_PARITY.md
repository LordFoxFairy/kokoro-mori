# Mori × Suno 能力对齐基线

> 核验日期：2026-09-13
> 目标：先对齐 Suno 已验证的核心用户任务，再发展 Mori 的可解释、可恢复、provider-neutral AI Music 工作流。

## 1. 对齐口径

Mori 不按页面数量或按钮名称判断“对齐”。每项能力分三层核验：

```text
Surface   用户在正确的 Project / Version 上下文中可以找到并完成操作
Contract  浏览器只使用 Mori 同源、provider-neutral、可校验的契约
Runtime   真实 owner / provider 可以持久化、恢复并交付音乐结果
```

- **已对齐**：三层均有当前证据。
- **浏览器已对齐**：Surface + Contract 已落地，真实 provider 集成仍待 owner 验证。
- **部分对齐**：已有正确入口，但关键事实、交付或专业编辑能力缺失。
- **缺失**：当前没有可用闭环，不用 preview 文案冒充完成。
- **后置**：属于有效能力，但不阻塞生成到成品的 P0 闭环。

当前仓库只拥有 Surface、浏览器状态和同源契约映射；真实 Project、Version、Asset、Release 与音乐执行事实仍由
对应 owner 承接。因此本文不会把 mock API、preview waveform 或固定 asset ref 计为 Runtime 对齐。

## 2. Suno 当前能力事实

以下只使用 Suno 官方帮助中心、Release Notes 与 Platform：

- [Create · Simple](https://help.suno.com/en/articles/2462273) 与
  [Custom lyrics](https://help.suno.com/en/articles/2415873)：一句话生成或显式控制歌词、纯音乐、风格和标题。
- [Audio Uploads](https://help.suno.com/en/articles/6141569)：录制或上传音频并进入 Library，后续可用于 Extend、Cover 等创作。
- [Song Editor](https://help.suno.com/en/articles/6141505)：Replace、Extend、新增、移动、Split、Crop、Fade 与歌词修改。
- [Remaster](https://help.suno.com/en/articles/8105281)：保持作品核心，按 Subtle / Normal / High 调整音质和制作变化。
- [Voices](https://help.suno.com/en/articles/11362369) 与
  [Voices FAQ](https://help.suno.com/en/articles/11362433)：复用经验证的个人声音；Style Personas 继续保留在 Voices 入口中。
- [Studio 2.0](https://help.suno.com/en/articles/13670529)：多轨、录音、Chat Bar、MIDI、效果器、automation、synth 与 advanced stems；其核心 transport（Play、Record、Loop、Follow Playhead、节拍器、BPM、拍号）位于时间线之上。
- [Take Lanes](https://help.suno.com/en/articles/13670913)：每次生成两版，原位试听、评价并非破坏性 Commit。
- [Studio Library](https://help.suno.com/en/articles/13670849)：右侧 dock 内搜索、试听、拖放 Library / Upload / Stem / Workspace 资产，并按项目记忆筛选和搜索视图。
- [Studio Export](https://help.suno.com/en/articles/8128193)：整曲、选区、多轨、单 clip 与 MIDI 交付。
- [Share](https://help.suno.com/en/articles/2565761) 与
  [Publish](https://help.suno.com/en/articles/2551361)：Link-only 分享与 Public 发布是不同动作。
- [Custom Models](https://help.suno.com/en/articles/11362497)：Create 的模型选择器支持基于用户歌曲建立私有模型；这是创作身份与训练生命周期，不是普通 Style 文本。
- [Suno Platform](https://platform.suno.com/)：官方 REST API 入口已经上线，匿名页确认支持 original songs、covers、mashups；
  API account 和详细文档需要使用关联 Suno 账号登录。登录核验前不猜 endpoint、鉴权、限流、credits 或任务状态机。

Suno 的产品主干不是“一句话生成”，而是：

```text
Prompt / Upload
  -> Takes
  -> audition / commit
  -> edit / stems / timeline
  -> saved versions
  -> export / share / publish
```

Mori 的浏览器主干现在把 `Generation Queue -> Project Review` 作为显式交接：生成成功后，Queue 提供带
`generation_ref` 的 Project 入口；Project 只读取该次运行的候选，用户可以试听、`Set as current`，再进入对应
Studio。这样“生成结果属于哪个 Project、来自哪次运行、下一步如何继续”不依赖全局 active 指针，也不把全部历史
候选混在一次结果里。

### 2.1 2026-09-13 登录态 Web 复核

本次直接复核 Suno 的 Create 与 Studio 页面，只记录可见的产品能力，不把账号内容、内部请求或 provider 字段写入 Mori：

- **Create**：Simple / Advanced 两种入口；模型选择（包含私有 Custom Model 入口）；Audio、Voice、Inspo 三类创作上下文；Lyrics 编辑器及写作辅助；Styles 输入与推荐风格；More Options；Save to Workspace；下方还有搜索、筛选、排序、List/Grid 视图和生成 clip 的试听、编辑标题、评价、分享、发布动作。
- **Studio**：Project 菜单、Preview/Upgrade to edit、Undo/Redo、位于时间线之上的 Back to Start / Record / Play / Loop / Follow Playhead / Metronome / BPM / 拍号 transport、Export、右侧 Library dock；时间线有 Track、Add New Track、Magic Bar，以及 Plugins、Automation、Clip editor、Take lanes、Playable keyboard 和 Zoom。

这次复核将 Mori 的优先级固定为：先把 Create 的输入上下文、Queue 到 Project 的结果交接、Studio 的全局 transport、时间线范围、Take lanes、Library 与非破坏式变更做成一条连续主链；模型目录、BPM/拍号、真实 Add Track、MIDI、Effects、Automation、Synth 只有在 owner contract 和真实 render/clock 边界成立后再开放，不用 disabled 按钮制造“已经支持”的错觉。

## 3. 当前能力矩阵

| Suno 用户任务 | Mori 当前状态 | 当前证据 | 对齐决策 |
|---|---|---|---|
| Simple / Custom 生成歌词歌或纯音乐 | 浏览器已对齐 | `create-canvas.tsx`、`mori-workspace.tsx`；Smart 额外提供可编辑 Song Plan，Song idea 提供 `Surprise me` 起点，Custom 的 Style 提供推荐 starter 并保留可编辑输入 | 保留 Mori 的 Approach / Output 分离，不复制 Suno 表单层级；推荐 starter 只改 provider-neutral `style` 文本，不改变生成契约 |
| 每次生成多个候选并持续跟踪 | 浏览器已对齐 | Generation Queue、snapshot、SSE、cancel、retry、Candidate projection；成功后可通过 `generation_ref` 深链进入 Project Review | Runtime 以真实 provider integration smoke 为完成门槛 |
| 上传 / 录制音频并跨项目复用 | 部分对齐 | Create 与 Studio Arrangement 都支持浏览器麦克风录音；录音复用 Creative Source Upload Session，上传中可取消，失败可复用当前录音重试，持续 processing 轮询，ready 后作为 Audio Source 进入 Dock，并由用户明确 Insert 到选中 Track / Range；Create 保留刷新恢复 upload metadata，preview Studio 使用本地 Blob，live Studio 使用现有 upload contract | **P0：正式 Creative Source Ingest** |
| Cover / Extend / Replace / Remaster | 浏览器已对齐 | Arrangement Change Plan、typed snapshot、Take Lanes、Finish Remaster | 补真实执行验收；Mori 的 Balanced / Bold 是自有语言，不冒充 Suno 原词 |
| Add vocals / Add instrumental / Lyrics revision | 浏览器 foundation 已对齐 | Voice & stems、Lyrics Revision、Studio 的 owner-confirmed Lyrics Draft seam | Lyrics runtime 由 Workspace owner 接通并做 recovery smoke；浏览器不再以 localStorage 冒充保存 |
| Take audition / Review / Commit / Current Version | 浏览器已对齐 | Open、Playing、Selected、Current 分离；Queue 成功结果可回到 generation-scoped Project Review；Preview A/B 有本地可播放 fixture；Take 评价按 project + generation + candidate 保持在 Studio 会话内；Project-scoped CAS；Project Current 投影区分 known / none / unknown，不在查询失败时按候选顺序猜测 | **P0：Durable Project Memory 的 Version / Revision 一致性** |
| 保存版本、刷新或跨设备继续 | 浏览器 foundation 已对齐 | Current/Mix/Release 有契约；Workspace projection、Open Version、Studio Lyrics Draft、Lyrics Revision、Stem Separation、Finish Artwork / Export 与 Create Smart Song Plan 的 owner-confirmed 保存/任务恢复状态机已落地浏览器 | **P0 继续：真实 BFF runtime recovery 与 Song Plan 历史** |
| Library / Workspace 搜索与素材复用 | 浏览器 foundation 已对齐 | Projects、Versions、Audio/Voice/Inspiration Sources、cursor/search/filter；Create 与 Studio AI / Add vocals 共用 availability gate，Studio Asset Dock v1 支持当前 Track / Range 内搜索、Audio 试听、点击插入与直接拖到任意 Track / 时间位置（100ms 对齐并按版本边界裁剪），Voice / Inspiration 明确 reference-only；live source loading / unavailable 时不展示 preview fixture，Voice / Inspiration picker 显示状态并提供 Retry，ready 后可在当前 Dock Load more | 接入真实 Source 生命周期、媒体投影与拖放后的 owner Placement |
| Song Editor 的 Split / Crop / Fade / Move / Remove | 浏览器 foundation 已对齐 | `Composition { tracks[] }`、轨道上下文选择、空轨道选择、可读的 Take / Source Clip 标签、Clip 时间范围摘要、Clip 与 AI Scope 的显式分离、Clip 编辑面板与 Move / Trim / Split / Crop / Fade / Insert / Remove 原语、同轨与跨轨直接拖动、目标轨 drop 状态、Undo / Redo 已存在；选中 Clip 可点击 Remove，也可用 Delete / Backspace 快捷键；候选 Take 可以插入已选时间范围；新建 placement 使用唯一 opaque `clip_ref`；选中 Clip 可复用全局 Player 按 source offset / duration 试听；命令均有源 `track_ref`、可选 `target_track_ref`、revision 与 owner seam，Studio 已能加载非空多轨 projection；owner projection 加载期间编辑被锁定并显式标记 busy；无 owner projection 时保留 Main track fallback；未保存 Composition 在切换工具、Version 或离开 Project 前会进入显式保护层，Arrangement editor 保持 mounted，不静默丢失 pending commands | P1 接入真实 Composition owner persistence，并扩展 Track / Placement projection |
| 多轨 timeline、录音编排、loop、tempo、zoom | 部分对齐 | Create / Arrangement 已支持录制 Audio reference，ready 后由用户明确放入选中 Composition Track / Range；Arrangement 已提供复用全局 Player 的 `Back to start`、playhead / selected-range audition、loop 与 100% / 150% / 200% / 300% 视图缩放，但仍缺 composition loop、tempo 和真实多轨 owner | P1：扩展 Track / Clip / Placement，并接入真实 owner |
| Advanced Stems 与 mixer | 部分对齐 | Split intent、异步恢复、同步试听、Mute/Solo/Gain/Pan、Mix Revision | 补真实 stem manifest 与 composition placement |
| 整曲 / 选区 / 多轨 / MIDI 导出 | 部分对齐 | Export 已支持默认 Full song 与 Arrangement 当前 selected time range 的 MP3/WAV；snapshot 严格回显范围 | P1：Multitrack、单 clip、MIDI 与 artifact manifest |
| Link-only 分享与 Public 发布 | 浏览器已对齐 | Release draft、独立 Share/Publish/Unpublish 命令、Copy share/public link；真实 owner 权限与 URL smoke 待接通 | **P0：完成真实 Share / Publish owner 集成** |
| MIDI、Effects、Automation、Synth | 缺失 | Track inspector 的 Level / Pan / Mute 与 `set_track_mix` 浏览器基础已存在，但仍无 MIDI、Effects、Automation、Synth 的可靠 Composition Revision 承载 | P1 后段；先接真实 mix render，再做 automation lane / MIDI |
| AI 自定义插件、Web MIDI controller | 后置 | 不影响核心创作到交付闭环 | 暂不追逐功能数量 |
| Voices / Personas / Custom Models / Taste | 部分对齐 | Voice source 与 Vocal direction 已分离；尚无创建、验证、训练和版本生命周期；Suno 当前已把 Custom Model 放入 Create 的模型选择器，要求至少六首拥有权明确的歌曲并支持私有模型 | P2：Creative Identity 与显式 consent；先做模型/声音身份的 owner contract，不把 Custom Model 伪装成 Style preset |
| Sounds / Sample / Mashup | 缺失 | 无独立可交付 sample/loop 模型 | P2；复用 Source + Generation + lineage，不增全局工具墙 |

## 4. 执行顺序

### 4.0 Arrangement 的连续 AI 入口

Suno Studio 的自然语言入口应当贴近时间线，而不是让用户滚动到素材和 Take 区域之后才发现 AI 能力。Mori 当前在
Arrangement 顶部使用 compact **Mori AI Command Bar**：四个一级意图、当前 Scope、输出数量、Take lanes 去向和
Review change 首屏可见；Reference、Restyle/Cover、Voice 与保护项放在 More controls。它只改变信息层级，不新增
第二套请求或任务状态机：Review 仍生成既有 Change Plan，Generate 仍走既有 Generation / Take Lanes 契约。

打开 Studio Version 时，Global Player 预置该 Version 的暂停状态，但不自动播放、不写入 Up next，也不覆盖已有的明确
试听选择。这样“当前正在制作的 Version”和“底部可以试听的 Version”保持同一上下文，同时不把浏览页面误认为播放动作。
如果用户已有另一条 Version 正在试听，Mori 会在 Studio 标题旁明确显示 Player 当前对象，并提供 `Play this version`；
只有用户确认后才切换同一个全局 transport，避免打开工作面时静默抢占听音意图。

### P0 · Suno 核心闭环

#### P0.1 Durable Project Memory

用户离开后必须恢复同一个 Song Plan、Lyrics Draft、Current/Open Version、最新 Mix 与未完成任务。

- UI：Studio 顶栏 `Saving / Saved / Retry`；Project 展示真实 Song Plan；Versions 展示时间、来源操作和保存状态。
- Contract：BFF-composed workspace projection；Song Plan / Lyrics Draft 的 revisioned GET/PUT；写入携带
  `expected_revision` 与 `Idempotency-Key`；恢复历史时创建新 Revision，不覆盖旧事实。
- 完成指标：静默丢稿为 0；刷新恢复成功率不低于 99.5%；保存确认 p95 小于 2 秒。
- 暂不做：多人逐字符协作、复杂分支图、merge UI。

#### P0.2 Creative Source Ingest

- UI：沿用现有 Audio Source 卡，支持选择文件或 Record / Stop 麦克风参考，并增加 uploading / processing / ready / failed / cancelled 与 Retry；页面中断后恢复同一 project 的 upload metadata，提供 Continue / 重新选择同一文件。真实文件字节仍由用户重新提供，不落 localStorage。
- Contract：Upload Session 创建、状态、取消、完成；只向浏览器返回 opaque `asset_ref` / `source_ref`。
- 完成指标：有效文件上传成功率不低于 98%；刷新后仍能在 Library 复用。
- 暂不做：批量上传、波形裁剪、分片断点续传。

#### P0.3 Finish、Share 与 Publish

- UI：Release draft 保存成功后才出现独立 Publish；Library 显示发布状态和 Copy release link。
- Contract：Release command 绑定 Version、draft revision、visibility、remix permission；幂等且可撤销分享。
- 完成指标：重试产生重复 Release 为 0；编辑深链不再冒充公开链接。
- 暂不做：Feed、评论、榜单和外部分发。

### P1 · Professional Workflow

1. **Composition + Studio Asset Dock**：revisioned Track / Clip / Placement；move（含同轨拖动）、split、trim、fade、insert、remove、undo；Asset Dock v1 的搜索、全局试听、当前 Track / Range 点击插入，以及 Audio 到任意 Track / 时间位置的拖放已完成浏览器侧，真实 owner persistence 与拖放后的 Placement projection 仍待接入。
2. **Take Review**：试听后可对每个 Take 标记 Works / Needs work，并用 Sound quality、Timing feels off、Too many layers 做最小归因；反馈保持在 Mori Studio 会话内，不冒充已同步 Taste，也不改变 Current 或 Use take。`Too many layers` 可直接回到 Voice & stems。
3. **Selected range / Multitrack Export**：Selected range 已扩展现有 Export；下一刀是等待真实 artifact contract 后接入 Multitrack，不另建一次性工具页。
4. **Mixer / Effects / Automation / MIDI**：从单轨 inspector、一条 automation lane 和独立 MIDI clip editor 开始。
5. **Loop / Tempo**：录音入口已落在 Create 的 Creative Source；浏览器侧先提供 selected-range loop 作为 audition 行为，继续做 Composition loop / tempo 前先建立真实 composition clock 与 input-device 边界。

### P2 · Mori 平台能力

1. **Version Lineage**：说明每版来自哪个计划、范围、Source、约束和父 Version，可复用 recipe 或分叉。
2. **Feedback → Taste**：Take 赞/踩和结构化原因形成版本化 Creative Profile，不默认隐式训练。
3. **Creative Identity**：Voice、Style Persona、Custom Model 的 consent、验证、版本与删除生命周期。
4. **Collaboration / Remix Graph**：成员权限、Release permission、Fork lineage 与 attribution 分开建模。

## 5. P0.1 当前实现门槛

P0.1 先固定浏览器契约与状态机，不越界实现 BFF。当前已完成 Workspace projection、Song Plan / Lyrics Draft /
Open Version 三项 revisioned 写入的浏览器类型、严格 response parser、原幂等键 retry 状态机，以及 Project
Overview 对真实 Song Plan 的只读呈现：

```text
ProjectWorkspaceProjection
  -> current Song Plan
  -> current/open Version
  -> latest Lyrics Draft revision
  -> latest Mix Revision
  -> active durable task refs
  -> revision cursor
```

当前仍只算 **P0.1 browser foundation**，不是 Runtime 完成：Studio Lyrics 已移除 localStorage 保存，先把显式
Studio URL 同步为用户的 Open Version，再通过 revisioned Workspace command 保存该 Version 的 Draft。文字在保存中锁定；
只有 owner 返回完整且精确匹配的新 revision 后才显示 `Saved`；短暂网络失败复用原 `Idempotency-Key`，冲突要求刷新；
切换 Version 时提供 Keep editing / Discard & open / Save & open，避免静默丢稿。Create Smart 现在也先读取最新 Workspace，
通过同一条 revisioned Song Plan command 保存用户复核后的计划，确认完整 projection 与 `song_plan_ref` 后才创建 Generation；
生成阶段重试复用已确认的计划，不重复写入；Generation 响应不确定时复用原 request / 幂等键，确定性拒绝后才创建新的
command identity；live Project 不回退到 legacy Song Plan POST。只有本地 preview Project
保留 legacy POST 作为演示分支，并明确标记为 preview，绝不以 `saved` 假装为用户的持久化事实。真实 BFF owner 随后需实现
projection 组合、revision 存储、幂等 receipt 与 recovery smoke。

以下两个浏览器侧连续性问题已修完：

1. Project Candidate 可在 Overview 明确 `Set as current`，仅在 CAS 精确确认后开放或重定向 Continue making。**已完成。**
2. Studio 选择或提交 Take 后，canonical URL、Open Version、刷新恢复和 Copy link 必须指向同一 Version。**已完成。**

这两项是 Durable Project Memory 的入口一致性，不是额外功能。

## 6. 供应商边界

- Suno API 是 provider adapter 候选，不是 Mori 的浏览器 API。
- 详细 API docs 登录核验完成前，只记录“官方账号门控 REST API 存在”。
- Provider model、credits、状态名、媒体 URL 和错误原文不得进入 React component 或 Mori Domain。
- 接入顺序：冻结官方文档证据 -> owner adapter contract -> BFF 同源 projection/command -> Mori runtime parser -> integration smoke。
