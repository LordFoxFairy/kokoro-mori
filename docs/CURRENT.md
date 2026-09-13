# Mori 当前状态

> 更新：2026-09-13
> 范围：本地 preview 产品壳、Create、Library、Project、Studio 与 Finish 工作面。

## 已实现

- 全部歌曲、候选、素材、Take、版本历史与播放器时长统一经过 `format-music-time.ts`；实时播放位置向下取整，静态媒体时长四舍五入，录音计时保持 `00:00`，不会把浮点 `timeupdate` 值泄漏到界面。
- 浅色、整高 Rail + 内容面 + 全局 Player 三层壳体；桌面展开 Rail 不使用悬浮窗口。
- 移动端 Rail 默认收起；展开后为带遮罩的导航抽屉，锁定背景滚动、焦点进入并循环在 Rail 内，内容面与 Player 使用 `inert` 隔离，关闭后恢复触发入口。
- 全局 Player 的 `Up next` 在桌面作为上下文面板，在移动端作为 modal sheet；支持 Escape、焦点恢复和移动端焦点循环。
- Studio 固定为工具 / 画布两栏；Arrangement 在宽屏内将 Suno-like Library 作为可开关的右侧 dock 放在时间线旁，窄屏自然回到主内容下方；Project Version history 统一由 Studio 顶部 Versions 动作打开上下文抽屉，不挤压画布或替代 Global Player。
- Create → Generation Queue → Candidate → Project / Version → Studio → Take Lanes → Current Version 的本地闭环。
- Create 的 Custom controls 现在提供少量 Suno-like Style starters：点击只把策展方向写入可编辑 Style 字段，仍由用户决定最终文本，不增加第二套 provider 或模型契约。
- Create 的 Smart 首次提交现在要求先填写 Song idea：空提交停留在当前表单、聚焦输入框并显示就地校验，不再生成一个“开放式新方向”的假计划；Custom 仍保留仅凭 Style / Output controls 直接进入队列的 Suno-like 高级路径。
- Generation Queue 的成功结果现在提供明确的 `Review directions in Project` 去向；即使候选 projection 暂时为空，也显示 `Directions are still syncing` 而不是诱导创建第二次生成，并把用户送到带 `generation_ref` 的 Project Review；Project Overview 只加载该次运行的方向并复用同一试听、Set as current 与 Open Studio 决策链，避免生成完成后把用户留在孤立队列里。
- Studio 在切换 Take 时会用所选 Candidate 的 `generation_ref` 规范化 URL，不保留旧生成上下文；同一 Version / Take 链路不会因浏览器历史 query 误恢复另一条 Studio run。
- Home 在 Project 已报告存在方向、但候选列表尚未到达时也显示 `Directions are still syncing`，并回到该 Project；不会把 owner 的延迟 projection 误报成 `No directions yet` 或引导用户创建重复方向。
- Generation-scoped Project Review 在候选 projection 暂时返回空数组时显示 `Directions are still syncing` 与 `Retry this generation`，不再把一致性延迟误报成“本次运行没有结果”并诱导重复生成；重试仍绑定原 `generation_ref`。
- Project Review 现在在候选方向原位提供 `Works / Needs work` 反馈；负面反馈可标记 Sound quality、Timing feels off 或 Too many layers，按 Project / Generation / Candidate 保持在当前浏览器会话内，不改 Current、不写入 Taste，也不阻断试听、Set as current 或 Open Studio。
- Studio Arrangement / Lyrics / Stems / Finish 工作面，以及 Add part、Replace section、Extend、Transform（Restyle / Cover）的一层 AI 意图模型。
- Arrangement 的未保存编辑不再因切换 Studio 工具或 Version 静默丢失：Arrangement editor 保持 mounted，切换 Lyrics / Voice & stems、打开另一 Version 或返回 Project 前会出现 Keep editing / Discard & continue / Save & continue；保存仍通过原 Composition revision 与幂等键，冲突提供 Refresh arrangement，浏览器刷新/关闭也会触发离开提醒，Global Player 不受保护层影响。
- Arrangement 的状态文案现在与数据事实一致：加载中显示 Loading，空 owner projection 显示 Baseline only，不可用 projection 显示 Preview only，不再在未确认 owner 数据时显示 Saved。
- 已知 Preview Project 的 Studio Arrangement 现在直接使用本地 preview controller 与候选 projection：首屏立即展示 version baseline，不等待不可用的 BFF composition 请求；提交 Studio Change 后会通过同一条本地 generation / candidate projection 展示可试听的确定性 Preview Takes；注入的 owner API 仍优先用于真实 projection 与测试边界。
- Studio Arrangement 已增加 Asset Dock v1：在当前时间线上下文内搜索并按 All / Audio / Voices / Inspiration 筛选 Creative Source；Library Audio 可复用同一个全局 Player 试听，也可以从 Audio 卡片直接拖到任意 Composition Track 的时间位置，按 100ms 对齐并在版本边界内裁剪；点击 Insert 仍作为选中 Track / Range 的键盘与低精度指针 fallback，插入动作明确绑定当前 Track、位置和 `source_ref` 并生成新的 Composition revision；Voice / Inspiration 显示为 Arrangement 中的 reference-only，避免把不可插入来源伪装成音频素材。
- Studio Arrangement 的 Asset Dock 现在以宽屏右侧 Library dock 呈现，可从 Arrangement 工具栏显式隐藏/恢复；关闭只改变浏览器布局，不清空搜索、筛选、选区、Track 或 Composition revision。
- Studio Arrangement 的 Asset Dock 现在提供 Record a reference：复用 `useAudioRecorder` 和既有 Creative Source Upload Session，录音完成先上传 / processing，ready 后作为新的 Audio Source 出现在当前 Dock；用户仍需明确点击 Insert 才放入选中的 Track / Range，不会自动改变 Composition。Preview Project 使用浏览器本地 Blob 音源，live Project 使用现有 upload contract，上传中可取消、失败可复用当前录音重试，并保留可解释状态；live Source projection 还会在 Dock 内按 opaque cursor Load more，不把 Library 搜索上下文打断。
- Studio Export 已支持 Full song 或当前 Arrangement 选区：默认仍导出整曲，用户在同一窗口选择 `Selected range` 后，选区的 `start_ms` / `end_ms` 会随 Version 或 Mix Revision 一起进入异步 render request 与 snapshot；多轨 / MIDI 仍未暴露。
- Studio Arrangement 的当前 AI edit range 现在可以直接通过全局 Player 试听：Preview selection 复用同一个媒体通道，从选区起点开始并在终点自动暂停、回到起点；Loop selection 仍复用同一 transport，在 timeupdate / ended 时回到选区起点并保持播放；修改选区、切换 Version、离开 Arrangement 或媒体失败都会清除 loop 状态。Player 显示 Range audition / Looping 上下文，普通整曲试听、Take 切换和 AI Scope 仍保持独立，不创建第二个播放器。
- Studio Arrangement 时间线现在提供 `Play from playhead`：它只驱动全局 Player 的同一 transport，从当前可见 playhead 开始试听；如果当前正在试听选区或 Clip，会先回到整曲上下文再播放，避免时间线按钮、底部 Player 与实际音频状态割裂。
- Studio Arrangement 时间线现在提供 `Back to start`：它把当前试听从选区或 Clip 上下文收敛回整曲起点；如果此前已经在播放则保留播放意图，否则只重置位置，不创建第二个 transport。
- Studio Arrangement 时间线现在提供轻量 Zoom：100% / 150% / 200% / 300% 在同一横向画布上切换，Fit 随时回到全曲视图；缩放只改变浏览器视图，不改变 playhead、AI edit range、Composition revision 或全局 Player。
- Studio 的 Current Version 现在显式区分 `known`、`none` 与 `unknown`：只有 Project 的 `current_version_ref` 能标记 Current，Project 查询失败或缺失时不再按 Candidate 顺序猜测；unknown 状态保留试听与打开 Version，但暂不允许 `Use take`，明确返回 `null` 则提示用户选择一条 Take。
- Arrangement 首屏现在以时间线为主：用户先看到当前 Version、播放头、轨道、选区与固定 Player，再在时间线后方看到紧贴选区的 Mori AI Command Bar；Add part / Replace section / Extend / Transform、当前 Scope、输出数量、Take lanes 去向和自然语言 Review change 仍保持可达，Reference、Restyle/Cover、保护项等高级控制收进 More controls。选区或 Clip 变化仍即时同步到同一上下文栏，Review 只生成可核对的 Change Plan。
- Arrangement 的 Track controls 会区分真实 owner 保存状态与浏览器 baseline：未确认 owner projection 时显示 Preview only，保存中显示 Saving…，只有 owner-confirmed composition 才显示 Saved，避免把本地或预览 mix 误报成已持久化事实。
- 打开 Studio Version 时，全局 Player 会在不自动播放、不写入 Up next、也不覆盖既有试听的前提下预置当前 Version；用户看到的是可直接点击 Play 的暂停 transport，而不是与当前工作面割裂的 Choose a version 空状态。已有其他 Version 的试听选择会保持不变。
- 当 Studio 打开的 Version 与 Global Player 正在试听的 Version 不同，画布标题旁会显示明确的播放上下文和 `Play this version` 动作；它不会自动抢占用户当前试听，用户确认后才把同一 transport 切换到 Studio Version。
- Composition 中选中的 Clip 现在可以直接通过同一个全局 Player 试听：Player 按 Clip 的 source 与 offset / duration 建立 Clip audition scope；无可解析音频来源的 Clip 会保持禁用，不伪装成可播放。试听沿用全局播放、暂停、seek、loop 与媒体错误状态，不改变 Current Version、Arrangement 保存状态或 AI edit range；播放中切换 Range / Clip scope 会先换源、定位，再恢复播放意图，避免按钮显示 Playing 但实际无声。
- 多 Take 对比现在是 Studio 的可达主路径：当 Version 有多个候选时，顶栏显示带数量的 `Takes` 入口，点击会滚动到 Take Lanes、把焦点交给对比区域，并为固定底部 Player 保留滚动安全区；单候选时不显示无意义入口。
- Creative Source ingest 的浏览器 foundation 已收紧：live Project 不再把缺失的上传能力伪装成 preview asset；选择文件或完成麦克风录音后都复用同一 Upload Session，上传 command 在首个请求前生成稳定幂等键，同一文件失败重试会复用会话，并持续以退避轮询 processing 状态直到 owner 返回终态；录音中和上传进行中 Generate 都保持禁用。上传中刷新或页面卸载后，会按 project 记录 `upload_ref`、文件身份和幂等键，恢复时显示 Continue / 重新选择同一文件；真实文件字节不写入 localStorage，避免把浏览器临时文件伪装成持久化事实。
- Creative Source 的身份边界已固定：Audio Source 同时携带 Library/deep-link 使用的 `source_ref` 与可播放、可生成的 `asset_ref`；Create / Studio 只把后者写入 `reference_asset_refs[]`，Voice / Inspiration 不携带 Asset 身份。
- Create 与 Studio AI / Add vocals 现在共用 Creative Source availability gate：Studio 默认通过 `/library/sources` 读取 live Creative Source projection，组件接受同一 catalog；只有明确的 Preview Project 或本地新建 preview shell 使用 preview catalog，live source 加载中/失败时显示状态与 Retry、禁用 voice / inspiration picker，绝不把 preview source 当成真实素材。Audio reference 的上传 / 录音入口仍独立可用。
- Composition API seam 已固定 Version ref、幂等键与 revisioned input 的分离；`move_clip` 缺省为同轨移动，跨轨时携带可选 `target_track_ref`，并已提供同源 GET/PUT revision client；保存成功后会校验并采用 owner 返回的轨道投影，真实 BFF owner persistence 与 recovery smoke 仍待接入。
- Arrangement 现在在选中 Track 后提供折叠式 Track controls：Level、Pan、Mute 作为同一 Composition history 的 `set_track_mix` command 进入 revisioned save；控件明确标注“应用于后续 arrangement render”，因为浏览器当前没有多轨渲染 owner，不把本地 mix draft 冒充已渲染音频。
- Studio 重新打开 live Project / Version 时，会从 Workspace 的 `latest_mix_revision` 摘要读取完整 Mix Revision，并严格校验 ref、Version、revision、名称和轨道数后再提供给 Finish / Export；加载中、缺失 reader 或校验失败会明确显示 unavailable，保留 Open Version 路径，不静默使用旧混音。
- Studio Change 在 Review Plan 后才生成；请求 builder 统一 snake_case、范围、保护项、references 和输出数量，Add vocals / Add instrumental 与 Restyle 统一支持 `1 / 2 / 4` alternatives，并保持当前 Version 非破坏式。
- Mori API 与公共 Web package 保持本仓边界；未修改 Root、BFF 或 sibling service。
- 同源 adapter 现在透传 `kokoro_session` Cookie、固定 request ID，并拒绝浏览器自报 principal；非 loopback BFF 缺少服务端 trust 配置时 fail closed，避免 live 请求落到固定本地用户。
- 全局 Player 继续保持 viewport-fixed 的底部 transport；shell 通过同一组 `--mori-player-height` /
  `--mori-player-safe-space` token 预留可滚动安全区，短桌面视口将 dock 收敛到 72px，避免 Studio 的
  AI Changes / Take Lanes 被底部控件过度遮挡，移动端继续保留安全区与底部 sheet 行为。
- 移动端全局 Player 的 controls 与 seek 已使用父级两行网格：播放控制保持首行右侧，进度条跨满第二行，不再被嵌套布局压缩。
- 全局 Player 已接入窄化的 same-origin media seam：Candidate 只携带 opaque `audio_asset_ref`，浏览器通过
  `/api/v1/mori/assets/{asset_ref}/content` 获取真实音频；本地 preview ref 仅解析到 `public/audio/` 的可回归 fixture，
  不改变 live asset 路由。Provider 使用可注入的 media controller 同步真实 `play/pause/seek/mute/timeupdate/ended`
  状态，不再用定时器伪造播放。Candidate 缺少音频资产时显示 `Preview audio is unavailable` 并禁用播放，真实媒体
  加载失败会停止 Playing、保留错误上下文并提供 Retry playback。
- 全局 Player 与页面 projection 已解耦：打开空 Project、Candidate projection 暂时失败或进入不可用的 Studio Version
  都不会清空正在播放的 Version、进度或媒体源；浏览 Library、Project 或 Studio 不会重写 `Up next`，队列默认
  为空，只在用户明确试听 Version（或启用明确的生成后自动播放偏好）时按 `version_ref` 加入或更新，避免同一 Version
  因不同 Candidate projection 重复出现。选择 Direction、设为 Current 或进入 Studio 只改变工作上下文，不会抢占当前播放；
  同一 Version 经不同 Candidate projection 出现时仍共享同一个播放身份和进度。单项队列禁用上一首/下一首，
  音源切换使用 selection epoch 忽略旧音源迟到事件，并把 Studio 首次定位同步 seek 到真实媒体，避免 transport
  进度与真实音频脱节或覆盖用户的新选择；旧音源的迟到 `play()` 结果不会污染新音源状态，队列跳到无音频 Version
  时也会收敛为 Paused。Playback Queue 将当前项独立显示为 Now playing，Up next 只显示当前项之后的候选；到达队列末尾时
  不隐式回绕，只有明确的下一项才启用 Next 或 endBehavior=next。
- Library 已接入 provider-neutral 的 live projection seam：Version 使用 `GET /library`，Creative Source
  使用独立的 `GET /library/sources` 与按 kind/ref 的 deep-link GET；两者各自使用 opaque cursor/limit，
  Audio / Voice / Inspiration 使用 discriminated union。Source API 成功后不再把 preview Sources 混入 live 响应；
  未配置 API 或所有 projection 都不可用时保留 preview fallback，单个 Source projection 失败则清空该区域并明确显示 unavailable，
  避免把过期 fixture 当成真实数据；Library 会消费 `next_cursor` 提供 Load more / Try again，Create deep link 会优先解析 live Source detail。
- Projects 在 live projection 失败时会明确标注当前展示的是 Preview workspace，并提供 Retry；恢复后自动切回真实投影，
  不把本地 fixture 静默伪装成用户数据。Home 首次进入保持真正的空工作区，只展示一句话起点和连接状态，不把 First Light
  之类的 preview Project 注入用户的 Recent/Current 语境；Projects 与 Library Versions 均消费 opaque cursor，分页追加按资源引用去重。
- Project Overview 将 Candidate projection 的 `loading`、`ready` 与 `unavailable` 分开建模；请求失败时保留 Project
  返回的已保存数量并提供 Retry，不再把服务暂时不可用误报成 `No directions yet`，也不会诱导用户重复创建方向。
- Project Overview 现在也区分 Project projection 的 `loading`、`ready` 与 `unavailable`：连接未确认前不显示 Active、Current
  或可写项目动作；连接失败时仍允许试听已返回的候选，但 Set as current、Open Studio 和 New direction 会暂停，并提供 Retry project。
- Project Overview 的非 Current Candidate 提供明确 `Set as current`：它复用 Project-scoped、带幂等键与
  `expected_current_version_ref` 的 CAS command，等待 owner 精确确认后才更新 Current、`Open Studio` 与
  `Continue making`；瞬时失败允许重试，冲突引导刷新 Project，过程中不抢占 Global Player。
- Project Overview 与 Studio 会把当前 `project_ref` 传给全局 Rail；Rail 只提供稳定的 `New song` 主入口，当前作品以轻量
  `Recent` 上下文显示，不再用 `Current project / Active` 卡片制造第二套状态导航；Project 内的 `New direction` 仍由作品页
  自己承载，Home、Library 等无项目上下文的入口从全新 Project 开始。
- P0.1 Durable Project Memory 已落地浏览器 foundation：Project Workspace 以同源、完整 projection 恢复
  Current Song Plan、用户 Open Version、该 Version 的 Lyrics Draft、最新 Mix 摘要与活动任务；Song Plan、Lyrics
  Draft、Open Version 的写入分别携带 revision 与 `Idempotency-Key`，只在完整返回投影精确确认下一 revision 后
  才可显示保存成功。Studio 的 Lyrics Revision、Stem Separation、Finish Artwork 与 Export 会消费同一 projection 的活动任务，按
  task ref 读取 owner snapshot，严格恢复到当前 Project / Version，并继续原有状态轮询；跨刷新不再只依赖 React 内存。Project
  Overview 已读取真实 Song Plan；本地 fixture 则明确标为 `Preview plan`，不冒充持久化结果。
- Create Smart 已接入同一条 Workspace 写入边界：用户确认可编辑 Song Plan 后，浏览器先读取最新 projection，再以
  `expected_revision` 和幂等键保存 Current Song Plan；只有返回的 `song_plan_ref`、revision 与全部字段精确确认后才提交
  Generation。Song Plan 短暂失败保留原 command / 幂等键；Generation 响应不确定或队列 receipt 暂时无法落盘时也保留精确 request / 幂等键，生成重试复用已确认的 Song Plan，避免重复执行；live Project
  不回退到旧的 Song Plan POST。唯一例外是本地 preview Project：它仍可用 legacy POST 演示流程，并明确标为 preview。
- Create 的 Song idea 提供 `Surprise me` 随机起点：只替换未提交 prompt、清理旧 Song Plan preview，并把焦点返回输入框；不改变 Smart / Custom、歌词输出选择或生成 payload。
- P0.3 Release / Share / Publish 已接入浏览器链路：Release Draft 保存确认后，`public` 才开放 Publish，`link_only` 才开放
  Create share link；两者各自支持状态、幂等重试、刷新恢复、复制与撤销。收到 `202` 的 `publishing` / `creating` receipt 后，
  浏览器只用原 ref 以有界递增间隔读取 GET 状态，直到终态或明确提示重试，不重复 POST；Project / Version 切换和卸载会丢弃迟到结果。
  Library Version projection 可显示 Published / Publishing / Unpublished 与公开链接；真实 Release、Share 权限和 URL 仍由 BFF / Storage owner 提供 integration smoke。
- Studio Lyrics 已接入该 Workspace foundation：不再读写浏览器 localStorage。显式 Studio URL 会优先同步为用户的
  Open Version，完成确认前不会允许把文字写到错误 Version；保存期间文字与 AI Apply 锁定，只有完整 owner projection
  被当前 Project / Version 接受后才显示 `Saved`。短暂故障复用原 `Idempotency-Key`，冲突转为 Refresh；在有未保存文字时
  选择另一 Version 会明确提供 Keep editing、Discard & open、Save & open，不让导航静默丢稿。preview 文字可编辑但始终
  明确标为非耐久草稿。
- Generation 生命周期已补齐 Create、snapshot、SSE replay、cancel 与 Project Candidate list 的本仓 OpenAPI；Create 明确固定 `output_count: 2`，Studio Change 的候选数收敛为 `1 | 2 | 4` 并由请求类型、运行时解析与 OpenAPI 共同校验；标准 Studio Change 与 Layer snapshot 会回显 reviewed scope、instruction、preserve、references、output count，以及 Layer 的 part kind / lyrics / voice，刷新恢复不会退回 generic plan；Studio Change 在 receipt 不确定或队列持久化失败时保留同一 command/idempotency key，确认入队后才释放，显式 Retry 随后创建新 command；Candidate
  list 使用 opaque cursor/limit/generation filter，Create / Studio 生成结果恢复按 `generation_ref` 查询，页面投影统一消费全部分页并按 `candidate_ref` 去重。Generation queue
  以显式字段白名单保存多任务摘要、状态、进度、候选引用和 event cursor，不保存 prompt、lyrics、provider payload 或音频字节；
  Create 与 Studio Change 共用这份队列；Create 不会接管 Studio Change，Studio 路由会从 active generation ref 拉回 snapshot 并恢复工作上下文，
  工作区在切换任务或回到 Create 时也会按队列 kind 校验并同步后台 Studio Change，网络瞬时错误按退避重试而非立即伪装成失败，
  在切换任务时保持其他进行中任务的后台轮询。
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
- Studio 时间线在移动端将 View、Playhead 与试听动作分层排列，所有 transport action 都收在时间线卡片内，不再因标题与右侧工具同排而从窄屏右边溢出。
- Mori 的移动断点已统一到 700px：App Shell、Studio AI、Timeline、Composition lane 与 Creative Source library 在同一临界宽度切换，底部 Playback Queue 与 drawer 也统一使用 `--mori-player-height`，避免紧凑播放器时出现遮挡或空隙。
- Mori 的 701–900px 平板断点默认使用 64px compact Rail，不改写用户的桌面 Rail 偏好；Studio 在该宽度改为单列工作区，作品身份、工具 tabs 与 Version state 组成连续的顶部上下文带，AI 操作改为两列，避免工具栏、画布和表单被双侧栏压成窄缝。701–820px 的 Studio 顶部动作会独立换行，避免 Copy link、Takes、Finish、Export 被裁切。
- Composition 选中 Clip 后的试听、Move、Trim、Split、Crop、Fade、Remove、Duplicate 操作在窄屏自动换行并扩大触控命中区；时间线仍保持横向滚动，不把编辑动作挤出可视区域。
  Studio Header 提供项目级 Generation queue 入口，使用同一浏览器任务摘要展示后台运行、完成和需处理的任务，并可回到对应的 Create 或 Studio 上下文。
- 移动端 Studio Header 已改为上下文与动作分层：项目路径单独占一行，动作区可换行而不挤压路径；Take Lanes 的 Preview / Use take
  在窄屏扩展为 44px 命中区，Copy link、Runs、Versions、Takes、Finish、Export 保留可读标签并允许换行，保留“试听 → 对比 → 提交”的主决策链，不让固定 Player 造成误触。
- Studio 的 Open Version 已成为 canonical route：选择 Take 或成功设为 Current 后会保留现有 surface/intent 并同步地址；
  Copy link 始终根据当前打开的 Version 构造，浏览器历史恢复时也会恢复对应 Open Version，不再出现画布、刷新结果与链接指向不同版本。
- Lyrics Revision 绑定发起时的 Version 与单调 command epoch；切换 Take 会立即清空旧 Version 的前台写作状态，迟到的 create、snapshot、event 或 cancel
  响应不会把旧计划、进度和建议投影到当前 Version，同一 Version 内切换 Studio 工具仍会保留进行中的 Revision。
- 移动端全局 Player 保留上一首、播放、下一首、静音、Up next 和 seek 进度，不再把核心听音控制隐藏在窄屏；dock 使用独立的两行安全区，
  Playback queue portal 与 Generation drawer 统一继承全局 Player 高度契约，不覆盖页面底部内容。移动端抽屉开合状态与桌面侧边栏偏好已分离，
  窗口跨断点切换不会改写用户的桌面折叠偏好。
- 桌面侧边栏折叠后仍保留 Mori brand mark，展开控制在 compact Rail 内独立占位而不覆盖品牌标识；701–900px 平板默认 compact、点击后可临时展开且不写入桌面偏好；移动端折叠态恢复水平顶栏，避免窄栏只剩孤立的控制图标。
- 桌面侧边栏支持 `⌘/Ctrl+B` 快捷切换，输入框、可编辑区域和 Settings 浮层中不会抢占用户的文字或弹窗交互。
- 有活动 Project 上下文时，展开 Rail 在 Workspace 导航下显示可点击的 Recent 项目入口；标题和方向/版本摘要从当前工作面更新，
  异步 Project projection 到达后也会同步到 Rail，不显示误导性的 Active 状态，不暴露内部 ref，收起 Rail 和无项目的全局入口不增加噪声。

## 验证证据

在本仓执行：

```text
pnpm lint                         passed
pnpm typecheck                    passed
pnpm exec vitest run --maxWorkers=1 src/features/mori/studio-page.test.tsx
                                  passed: 1 file / 113 tests
pnpm exec vitest run --maxWorkers=1 src/features/mori/composition*.test.ts src/features/mori/components/composition-lane.test.tsx src/features/mori/components/studio-asset-dock.test.tsx src/features/mori/components/studio-timeline.test.tsx
                                  passed: 10 files / 50 tests
pnpm exec vitest run --maxWorkers=1 src/features/mori/mori-workspace.test.tsx
                                  passed: 1 file / 78 tests
pnpm exec vitest run --maxWorkers=1 src/features/mori/mori-responsive-layout.test.ts
                                  passed: 1 file / 5 tests
pnpm exec vitest run --maxWorkers=1 src/features/mori/use-audio-recorder.test.tsx
                                  passed: 1 file / 2 tests
pnpm test                         passed: 86 files / 706 tests
pnpm build                        passed
```

## 已知边界

- 当前页面仍保留 preview fallback；真实 provider 适配、持久化 Project/Version/Source 和公开 Product API
  由后续 owner contract 驱动，不在组件内伪造。Library 的浏览器契约已先固定投影形状，供后续同源 owner 接入。
- Creative Source ingest 仍未达到 P0.2 完成门槛：浏览器现在按 project 恢复 `upload_ref`、文件身份与幂等键，并提供 Continue / 重新选择同一文件，同时会中止过期的浏览器上传请求；刷新后仍需用户重新选择文件，真实字节上传、麦克风权限/设备矩阵、Storage 扫描、过期/取消 integration smoke 与 Playwright 全流程仍待 owner 接入和验证。
- Durable Project Memory 仍处于 browser foundation：Studio Lyrics 与 Create Smart Song Plan 已通过 owner-confirmed
  Workspace command 接入浏览器 seam；BFF 仍尚未提供 projection 组合、revision 存储、幂等 receipt 与 recovery smoke。
  因此不把 preview Workspace 计为跨刷新、跨设备的 Runtime 恢复证据。
- `mori-workspace.module.css` 与部分历史组件仍有较大的聚合文件，后续按 shell、Studio surface、responsive responsibility 拆分，避免一次性重写导致视觉回归。
- 新能力必须先补 component / request-builder / contract test，再接入真实同源 API；不要把 `reference`、`voice` 或 `provider` 私有字段扩散到 UI。
