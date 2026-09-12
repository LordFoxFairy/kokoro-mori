# Mori 当前状态

> 更新：2026-09-12
> 范围：本地 preview 产品壳、Create、Library、Project、Studio 与 Finish 工作面。

## 已实现

- 浅色、整高 Rail + 内容面 + 全局 Player 三层壳体；桌面展开 Rail 不使用悬浮窗口。
- 移动端 Rail 默认收起；展开后为带遮罩的导航抽屉，锁定背景滚动、焦点进入并循环在 Rail 内，内容面与 Player 使用 `inert` 隔离，关闭后恢复触发入口。
- 全局 Player 的 `Up next` 在桌面作为上下文面板，在移动端作为 modal sheet；支持 Escape、焦点恢复和移动端焦点循环。
- Create → Generation Queue → Candidate → Project / Version → Studio → Take Lanes → Current Version 的本地闭环。
- Studio Arrangement / Lyrics / Stems / Finish 工作面，以及 Add part、Replace section、Extend、Transform（Restyle / Cover）的一层 AI 意图模型。
- Studio Arrangement 已挂载 `Composition { tracks[] }` 文档与 Clip 编辑面板；每个 Move / Trim / Split / Crop / Fade / Insert / Remove 命令都显式绑定 `track_ref`，通过本地 history、revisioned command、保存状态和冲突 rebase 串成浏览器侧闭环，并支持从候选 Take 将 Clip 插入已选时间范围、从已选 Clip Duplicate 到时间线末端，以及通过 Remove 或 Delete / Backspace 快捷键移除选中 Clip；Arrangement 顶部公开 Undo / Redo 与 ⌘/Ctrl+Z、⌘/Ctrl+Y 快捷键，保证删除和其他编辑可立即回退；时间线用 Take / Source 标题替代内部 ref，选中 Clip 会显示轨道、来源与时间范围，且明确不改变 AI Scope；同源 GET/PUT Composition seam 已接入，加载到的多轨 owner projection 会成为本地基线，组合 revision 独立于 Workspace Open Version revision；空 projection 与暂时不可用会明确标注，才保留 Main track fallback。
- Studio Arrangement 已增加 Asset Dock v1：在当前时间线上下文内搜索并按 All / Audio / Voices / Inspiration 筛选 Creative Source；Library Audio 可复用同一个全局 Player 试听，插入动作明确绑定当前 Track、选区和 `source_ref` 并生成新的 Composition revision；Voice / Inspiration 显示为 Arrangement 中的 reference-only，避免把不可插入来源伪装成音频素材。
- Studio Export 已支持 Full song 或当前 Arrangement 选区：默认仍导出整曲，用户在同一窗口选择 `Selected range` 后，选区的 `start_ms` / `end_ms` 会随 Version 或 Mix Revision 一起进入异步 render request 与 snapshot；多轨 / MIDI 仍未暴露。
- Studio Arrangement 的当前 AI edit range 现在可以直接通过全局 Player 试听：Preview selection 复用同一个媒体通道，从选区起点开始并在终点自动暂停、回到起点；Player 显示 Range audition 上下文，普通整曲试听、Take 切换和 AI Scope 仍保持独立，不创建第二个播放器。
- 多 Take 对比现在是 Studio 的可达主路径：当 Version 有多个候选时，顶栏显示带数量的 `Takes` 入口，点击会滚动到 Take Lanes、把焦点交给对比区域，并为固定底部 Player 保留滚动安全区；单候选时不显示无意义入口。
- Creative Source ingest 的浏览器 foundation 已收紧：live Project 不再把缺失的上传能力伪装成 preview asset；上传 command 在首个请求前生成稳定幂等键，同一文件失败重试会复用会话，并持续以退避轮询 processing 状态直到 owner 返回终态；Generate 在上传进行中保持禁用。
- Creative Source 的身份边界已固定：Audio Source 同时携带 Library/deep-link 使用的 `source_ref` 与可播放、可生成的 `asset_ref`；Create / Studio 只把后者写入 `reference_asset_refs[]`，Voice / Inspiration 不携带 Asset 身份。
- Studio AI 的 Reference audio 与 Cover voice 不再绑定单一 preview 常量；Studio 默认通过 `/library/sources` 读取 live Creative Source projection，组件接受同一 catalog，加载失败时才使用明确的 preview fallback。
- Composition API seam 已固定 Version ref、幂等键与 revisioned input 的分离，并已提供同源 GET/PUT revision client；保存成功后会校验并采用 owner 返回的轨道投影，真实 BFF owner persistence 与 recovery smoke 仍待接入。
- Studio 重新打开 live Project / Version 时，会从 Workspace 的 `latest_mix_revision` 摘要读取完整 Mix Revision，并严格校验 ref、Version、revision、名称和轨道数后再提供给 Finish / Export；加载中、缺失 reader 或校验失败会明确显示 unavailable，保留 Open Version 路径，不静默使用旧混音。
- Studio Change 在 Review Plan 后才生成；请求 builder 统一 snake_case、范围、保护项、references 和输出数量，并保持当前 Version 非破坏式。
- Mori API 与公共 Web package 保持本仓边界；未修改 Root、BFF 或 sibling service。
- 全局 Player 继续保持 viewport-fixed 的底部 transport；shell 通过同一组 `--mori-player-height` /
  `--mori-player-safe-space` token 预留可滚动安全区，短桌面视口将 dock 收敛到 72px，避免 Studio 的
  AI Changes / Take Lanes 被底部控件过度遮挡，移动端继续保留安全区与底部 sheet 行为。
- 全局 Player 已接入窄化的 same-origin media seam：Candidate 只携带 opaque `audio_asset_ref`，浏览器通过
  `/api/v1/mori/assets/{asset_ref}/content` 获取音频；Provider 使用可注入的 media controller 同步真实
  `play/pause/seek/mute/timeupdate/ended` 状态，不再用定时器伪造播放。preview Candidate 没有音频资产时显示
  `Preview audio is unavailable` 并禁用播放，真实媒体加载失败会停止 Playing、保留错误上下文并提供 Retry playback。
- 全局 Player 与页面 projection 已解耦：打开空 Project、Candidate projection 暂时失败或进入不可用的 Studio Version
  都不会清空正在播放的 Version、进度或媒体源；浏览 Library、Project 或 Studio 不会重写 `Up next`，队列默认
  为空，只在用户明确试听 Version（或启用明确的生成后自动播放偏好）时按 `version_ref` 加入或更新，避免同一 Version
  因不同 Candidate projection 重复出现。选择 Direction、设为 Current 或进入 Studio 只改变工作上下文，不会抢占当前播放；
  同一 Version 经不同 Candidate projection 出现时仍共享同一个播放身份和进度。单项队列禁用上一首/下一首，
  音源切换使用 selection epoch 忽略旧音源迟到事件，并把 Studio 首次定位同步 seek 到真实媒体，避免 transport
  进度与真实音频脱节或覆盖用户的新选择；旧音源的迟到 `play()` 结果不会污染新音源状态，队列跳到无音频 Version
  时也会收敛为 Paused。
- Library 已接入 provider-neutral 的 live projection seam：Version 使用 `GET /library`，Creative Source
  使用独立的 `GET /library/sources` 与按 kind/ref 的 deep-link GET；两者各自使用 opaque cursor/limit，
  Audio / Voice / Inspiration 使用 discriminated union。Source API 成功后不再把 preview Sources 混入 live 响应；
  未配置 API 或所有 projection 都不可用时保留 preview fallback，单个 Source projection 失败则清空该区域并明确显示 unavailable，
  避免把过期 fixture 当成真实数据；Library 会消费 `next_cursor` 提供 Load more / Try again，Create deep link 会优先解析 live Source detail。
- Home / Projects 在 live projection 失败时会明确标注当前展示的是 Preview workspace，并提供 Retry；恢复后自动切回真实投影，
  不把本地 fixture 静默伪装成用户数据。Projects 与 Library Versions 均消费 opaque cursor，分页追加按资源引用去重。
- Project Overview 将 Candidate projection 的 `loading`、`ready` 与 `unavailable` 分开建模；请求失败时保留 Project
  返回的已保存数量并提供 Retry，不再把服务暂时不可用误报成 `No directions yet`，也不会诱导用户重复创建方向。
- Project Overview 的非 Current Candidate 提供明确 `Set as current`：它复用 Project-scoped、带幂等键与
  `expected_current_version_ref` 的 CAS command，等待 owner 精确确认后才更新 Current、`Open Studio` 与
  `Continue making`；瞬时失败允许重试，冲突引导刷新 Project，过程中不抢占 Global Player。
- P0.1 Durable Project Memory 已落地浏览器 foundation：Project Workspace 以同源、完整 projection 恢复
  Current Song Plan、用户 Open Version、该 Version 的 Lyrics Draft、最新 Mix 摘要与活动任务；Song Plan、Lyrics
  Draft、Open Version 的写入分别携带 revision 与 `Idempotency-Key`，只在完整返回投影精确确认下一 revision 后
  才可显示保存成功。Project Overview 已读取真实 Song Plan；本地 fixture 则明确标为 `Preview plan`，不冒充持久化结果。
- Create Smart 已接入同一条 Workspace 写入边界：用户确认可编辑 Song Plan 后，浏览器先读取最新 projection，再以
  `expected_revision` 和幂等键保存 Current Song Plan；只有返回的 `song_plan_ref`、revision 与全部字段精确确认后才提交
  Generation。Song Plan 短暂失败保留原 command / 幂等键；Generation 响应不确定或队列 receipt 暂时无法落盘时也保留精确 request / 幂等键，生成重试复用已确认的 Song Plan，避免重复执行；live Project
  不回退到旧的 Song Plan POST。唯一例外是本地 preview Project：它仍可用 legacy POST 演示流程，并明确标为 preview。
- P0.3 Release / Share / Publish 已接入浏览器链路：Release Draft 保存确认后，`public` 才开放 Publish，`link_only` 才开放
  Create share link；两者各自支持状态、幂等重试、刷新恢复、复制与撤销。Library Version projection 可显示 Published /
  Publishing / Unpublished 与公开链接；真实 Release、Share 权限和 URL 仍由 BFF / Storage owner 提供 integration smoke。
- Studio Lyrics 已接入该 Workspace foundation：不再读写浏览器 localStorage。显式 Studio URL 会优先同步为用户的
  Open Version，完成确认前不会允许把文字写到错误 Version；保存期间文字与 AI Apply 锁定，只有完整 owner projection
  被当前 Project / Version 接受后才显示 `Saved`。短暂故障复用原 `Idempotency-Key`，冲突转为 Refresh；在有未保存文字时
  选择另一 Version 会明确提供 Keep editing、Discard & open、Save & open，不让导航静默丢稿。preview 文字可编辑但始终
  明确标为非耐久草稿。
- Generation 生命周期已补齐 Create、snapshot、SSE replay、cancel 与 Project Candidate list 的本仓 OpenAPI；Candidate
  list 使用 opaque cursor/limit/generation filter，页面投影统一消费全部分页并按 `candidate_ref` 去重。Generation queue
  以显式字段白名单保存多任务摘要、状态、进度、候选引用和 event cursor，不保存 prompt、lyrics、provider payload 或音频字节；
  Create 与 Studio Change 共用这份队列；Create 不会接管 Studio Change，Studio 路由会从 active generation ref 拉回 snapshot 并恢复工作上下文，
  网络瞬时错误按退避重试而非立即伪装成失败，在切换任务时保持其他进行中任务的后台轮询。
  Generation SSE 支持 AbortSignal，页面卸载时停止长连接；Create / Studio Change 的生成与取消命令带 epoch/context guard，
  Generation 与 Lyrics Revision 会在收到首批完整 SSE frame 后立即解析并取消本次 reader，不再等待长连接关闭；
  Lyrics Revision 同样把 AbortSignal 贯穿到同源 fetch，切换 Version 或卸载 Studio 会中止旧事件流。
  重复点击会进入 Stopping 状态，过期响应不会覆盖用户当前查看的任务。队列更新在支持 Web Locks 的浏览器中使用跨标签页互斥，
  并通过 storage event 的 old/new value 单调合并修复并发追加；终态、进度和候选引用不会被旧快照回退，冲突的 opaque event cursor 会安全回退至完整 replay。
  Create / Studio deep link 现在携带显式 `generation_ref`，同一项目的多个进行中任务可以各自恢复，不再依赖全局 active 指针。
  即使浏览器本地队列为空，Create / Studio 也会以 URL 中的 `generation_ref` 直接恢复 owner snapshot，校验 Project、Version 与 generation kind 后
  重新建立最小任务摘要；瞬时连接失败按有界退避继续恢复，不会要求用户回到原标签页或依赖同一份 localStorage。
- Settings 继续采用 Kokoro 的浮动窗口信息架构：侧边栏从当前 surface 原位打开设置层，不卸载 Create / Studio 草稿，`/settings`
  仍保留可直接访问的 fallback。搜索、键盘 tab 切换、Escape、焦点循环和背景 `inert` 隔离均保持可逆；移动端改为全宽搜索与横向 section navigation，
  交互控件使用 44px touch target。Settings 与 New Project 共用可嵌套的 body lock / shell isolation，成功态会把焦点留在弹窗内。
- Studio 时间线在窄屏提供横向滚动、键盘焦点和明确的 Swipe hint；短桌面视口的 Export dialog 会避开固定 Player safe area。
  Studio Header 提供项目级 Generation queue 入口，使用同一浏览器任务摘要展示后台运行、完成和需处理的任务，并可回到对应的 Create 或 Studio 上下文。
- 移动端 Studio Header 已改为上下文与动作分层：项目路径单独占一行，动作区可换行而不挤压路径；Take Lanes 的 Preview / Use take
  在窄屏扩展为 44px 命中区，保留“试听 → 对比 → 提交”的主决策链，不让固定 Player 造成误触。
- Studio 的 Open Version 已成为 canonical route：选择 Take 或成功设为 Current 后会保留现有 surface/intent 并同步地址；
  Copy link 始终根据当前打开的 Version 构造，浏览器历史恢复时也会恢复对应 Open Version，不再出现画布、刷新结果与链接指向不同版本。
- Lyrics Revision 绑定发起时的 Version 与单调 command epoch；切换 Take 会立即清空旧 Version 的前台写作状态，迟到的 create、snapshot、event 或 cancel
  响应不会把旧计划、进度和建议投影到当前 Version，同一 Version 内切换 Studio 工具仍会保留进行中的 Revision。
- 移动端全局 Player 保留上一首、播放、下一首、静音、Up next 和 seek 进度，不再把核心听音控制隐藏在窄屏；dock 使用独立的两行安全区，
  Playback queue portal 与 Generation drawer 统一继承全局 Player 高度契约，不覆盖页面底部内容。移动端抽屉开合状态与桌面侧边栏偏好已分离，
  窗口跨断点切换不会改写用户的桌面折叠偏好。

## 验证证据

在本仓执行：

```text
pnpm lint                         passed
pnpm typecheck                    passed
pnpm exec vitest run --maxWorkers=1 src/features/mori/studio-page.test.tsx
                                  passed: 1 file / 87 tests
pnpm exec vitest run --maxWorkers=1 <affected composition tests>
                                  passed: 4 files / 21 tests
pnpm test                         79 files / 581 passed; one order-sensitive failure was observed in the saved Mix Revision test
pnpm build                        passed
```

## 已知边界

- 当前页面仍保留 preview fallback；真实 provider 适配、持久化 Project/Version/Source 和公开 Product API
  由后续 owner contract 驱动，不在组件内伪造。Library 的浏览器契约已先固定投影形状，供后续同源 owner 接入。
- Creative Source ingest 仍未达到 P0.2 完成门槛：跨刷新恢复只保留 `upload_ref` 元数据，真实字节上传、Storage 扫描、过期/取消 integration smoke 与 Playwright 全流程仍待 owner 接入和验证。
- Durable Project Memory 仍处于 browser foundation：Studio Lyrics 与 Create Smart Song Plan 已通过 owner-confirmed
  Workspace command 接入浏览器 seam；BFF 仍尚未提供 projection 组合、revision 存储、幂等 receipt 与 recovery smoke。
  因此不把 preview Workspace 计为跨刷新、跨设备的 Runtime 恢复证据。
- `mori-workspace.module.css` 与部分历史组件仍有较大的聚合文件，后续按 shell、Studio surface、responsive responsibility 拆分，避免一次性重写导致视觉回归。
- 新能力必须先补 component / request-builder / contract test，再接入真实同源 API；不要把 `reference`、`voice` 或 `provider` 私有字段扩散到 UI。
