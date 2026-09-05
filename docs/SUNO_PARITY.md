# Mori × Suno 能力对齐基线

> 核验日期：2026-09-05
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
- [Studio 2.0](https://help.suno.com/en/articles/13670529)：多轨、录音、Chat Bar、MIDI、效果器、automation、synth 与 advanced stems。
- [Take Lanes](https://help.suno.com/en/articles/13670913)：每次生成两版，原位试听、评价并非破坏性 Commit。
- [Studio Library](https://help.suno.com/en/articles/13670849)：在 Studio 内搜索、试听、拖放 Library / Upload / Stem / Workspace 资产。
- [Studio Export](https://help.suno.com/en/articles/8128193)：整曲、选区、多轨、单 clip 与 MIDI 交付。
- [Share](https://help.suno.com/en/articles/2565761) 与
  [Publish](https://help.suno.com/en/articles/2551361)：Link-only 分享与 Public 发布是不同动作。
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

## 3. 当前能力矩阵

| Suno 用户任务 | Mori 当前状态 | 当前证据 | 对齐决策 |
|---|---|---|---|
| Simple / Custom 生成歌词歌或纯音乐 | 浏览器已对齐 | `create-canvas.tsx`、`mori-workspace.tsx`；Smart 额外提供可编辑 Song Plan | 保留 Mori 的 Approach / Output 分离，不复制 Suno 表单层级 |
| 每次生成多个候选并持续跟踪 | 浏览器已对齐 | Generation Queue、snapshot、SSE、cancel、retry、Candidate projection | Runtime 以真实 provider integration smoke 为完成门槛 |
| 上传 / 录制音频并跨项目复用 | 部分对齐 | 文件类型与大小校验、Audio Source UI；当前仍写固定 preview asset ref | **P0：正式 Creative Source Ingest** |
| Cover / Extend / Replace / Remaster | 浏览器已对齐 | Arrangement Change Plan、typed snapshot、Take Lanes、Finish Remaster | 补真实执行验收；Mori 的 Balanced / Bold 是自有语言，不冒充 Suno 原词 |
| Add vocals / Add instrumental / Lyrics revision | 浏览器 foundation 已对齐 | Voice & stems、Lyrics Revision、Studio 的 owner-confirmed Lyrics Draft seam | Lyrics runtime 由 Workspace owner 接通并做 recovery smoke；浏览器不再以 localStorage 冒充保存 |
| Take audition / Commit / Current Version | 浏览器已对齐 | Open、Playing、Selected、Current 分离；Project-scoped CAS | **P0：Durable Project Memory 的 Version / Revision 一致性** |
| 保存版本、刷新或跨设备继续 | 浏览器 foundation 已对齐 | Current/Mix/Release 有契约；Workspace projection、Open Version、Studio Lyrics Draft 与 Create Smart Song Plan 的 owner-confirmed 保存状态机已落地浏览器 | **P0 继续：真实 BFF runtime recovery 与 Song Plan 历史** |
| Library / Workspace 搜索与素材复用 | 部分对齐 | Projects、Versions、Audio/Voice/Inspiration Sources、cursor/search/filter | 接入真实 Source 生命周期；Studio 内 Asset Dock 放入 P1 |
| Song Editor 的 Split / Crop / Fade / Move | 浏览器 foundation 已对齐 | Composition track、Clip 编辑面板与 Move / Trim / Split / Crop / Fade / Insert 原语、Undo / Redo 已存在；Move / Trim / Split / Fade 已有 revisioned command，真实 owner save 仍待接入 | P1 接入真实 Composition owner，并扩展 Insert / Crop command |
| 多轨 timeline、录音、loop、tempo | 部分对齐 | 当前已有 provider-neutral Track / Clip projection 与单轨浏览器编辑；录音、loop、tempo 和真实多轨 owner 尚缺 | P1：扩展 Track / Clip / Placement，并接入真实 owner |
| Advanced Stems 与 mixer | 部分对齐 | Split intent、异步恢复、同步试听、Mute/Solo/Gain、Mix Revision | 补 Pan、真实 stem manifest 与 composition placement |
| 整曲 / 选区 / 多轨 / MIDI 导出 | 部分对齐 | 现有 Export 仅 Full song MP3/WAV | P1：Selected range、Multitrack、artifact manifest |
| Link-only 分享与 Public 发布 | 缺失 | Studio Copy link 只是编辑深链；Release 只有 draft | **P0：独立 Share / Publish 资源与权限** |
| MIDI、Effects、Automation、Synth | 缺失 | 无可靠 Composition Revision 承载 | P1 后段；先做最小 track inspector 与 automation lane |
| AI 自定义插件、Web MIDI controller | 后置 | 不影响核心创作到交付闭环 | 暂不追逐功能数量 |
| Voices / Personas / Custom Models / Taste | 部分对齐 | Voice source 与 Vocal direction 已分离；尚无创建、验证、训练和版本生命周期 | P2：Creative Identity 与显式 consent |
| Sounds / Sample / Mashup | 缺失 | 无独立可交付 sample/loop 模型 | P2；复用 Source + Generation + lineage，不增全局工具墙 |

## 4. 执行顺序

### P0 · Suno 核心闭环

#### P0.1 Durable Project Memory

用户离开后必须恢复同一个 Song Plan、Lyrics Draft、Current/Open Version、最新 Mix 与未完成任务。

- UI：Studio 顶栏 `Saving / Saved / Retry`；Project 展示真实 Song Plan；Versions 展示时间、来源操作和保存状态。
- Contract：BFF-composed workspace projection；Song Plan / Lyrics Draft 的 revisioned GET/PUT；写入携带
  `expected_revision` 与 `Idempotency-Key`；恢复历史时创建新 Revision，不覆盖旧事实。
- 完成指标：静默丢稿为 0；刷新恢复成功率不低于 99.5%；保存确认 p95 小于 2 秒。
- 暂不做：多人逐字符协作、复杂分支图、merge UI。

#### P0.2 Creative Source Ingest

- UI：沿用现有 Audio Source 卡，增加 uploading / processing / ready / failed / cancelled 与 Retry。
- Contract：Upload Session 创建、状态、取消、完成；只向浏览器返回 opaque `asset_ref` / `source_ref`。
- 完成指标：有效文件上传成功率不低于 98%；刷新后仍能在 Library 复用。
- 暂不做：批量上传、浏览器录音、波形裁剪。

#### P0.3 Finish、Share 与 Publish

- UI：Release draft 保存成功后才出现独立 Publish；Library 显示发布状态和 Copy release link。
- Contract：Release command 绑定 Version、draft revision、visibility、remix permission；幂等且可撤销分享。
- 完成指标：重试产生重复 Release 为 0；编辑深链不再冒充公开链接。
- 暂不做：Feed、评论、榜单和外部分发。

### P1 · Professional Workflow

1. **Composition + Studio Asset Dock**：revisioned Track / Clip / Placement；move、split、trim、fade、insert、undo。
2. **Selected range / Multitrack Export**：扩展现有 Export，不另建一次性工具页。
3. **Mixer / Effects / Automation / MIDI**：从单轨 inspector、一条 automation lane 和独立 MIDI clip editor 开始。
4. **Recording / Loop / Tempo**：建立在真实 composition clock 与 input-device 边界上。

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
