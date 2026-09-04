# Mori Preview Acceptance

> 记录日期：2026-09-04
> 范围：Mori 全局壳体、页面 IA、fixture-only 生成体验、Library/Studio/Transform/Finish、Current Version 提交、响应式 Version history 与 API client seam

## 验证命令

在 `kokoro-mori` 根目录执行：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

最近一次完整门禁结果：

- `pnpm lint`：通过，`--max-warnings=0`
- `pnpm typecheck`：通过
- `pnpm test`：通过，41 个测试文件、319 个测试
- `pnpm build`：通过，生成 `/`、`/create`、`/projects`、`/library`、`/settings`、`/help`、Project Overview 和 Studio 路由

## 页面巡检

本地启动：

```bash
pnpm dev --hostname 127.0.0.1 --port 3004
```

已巡检以下页面：

```text
/
/create
/projects
/projects/project_preview_first_light
/projects/project_preview_first_light/studio/version_preview_first_light_a
/library
/settings
```

每个页面均存在 Mori Rail 和 Global Player，且没有 Next Runtime Error。Web 桌面端采用
类似 Codex 的整高固定 Rail + 内容面布局，展开状态不再使用悬浮窗口；Rail 折叠按钮位于
品牌行内，桌面宽度下始终可见。Global Player 是跨页面、跨 Rail 的固定底部 transport
dock；桌面端提供歌曲、波形、进度和 transport，小屏幕收敛为歌曲信息、播放和队列入口。
播放队列现在属于全局 Player，而不是 Create 的生成队列：所有页面都可打开 `Up next`，选择版本后
立即切换播放；桌面端作为播放器上方的轻量面板，移动端作为紧贴播放器的底部 sheet，播放器本身保持可操作。
Create 的 `Generations` 默认关闭，可通过 `Generations` 动作打开并通过 Close generation queue 关闭；
移动端 390px 视口将收起的 Rail 收敛为 56px 顶部栏，只保留品牌与展开入口，内容使用完整宽度；
展开后使用带遮罩的导航抽屉，选择目的地、点击遮罩或按 Escape 都会关闭。Player 桌面端采用左侧当前歌曲、中部
transport + progress、右侧音量/队列的音乐播放器层级；移动端收敛为当前歌曲、播放和队列入口。
播放支持在非输入控件上使用 Space 快捷键，输入歌词或表单时不会拦截空格；播放主按钮声明对应键盘快捷键。

Library 已巡检 All、Versions、Sources、Lyrics、Exports 过滤器，以及版本 Play/Pause、项目和
Studio 链接；All 视图将 Projects & versions 与 Creative sources 分成连续但清晰的两个区域，Sources 再按
Audio、Voices、Inspiration 渐进筛选，避免把资产类型继续堆进全局 Rail。搜索会在当前分类内匹配项目、版本
标题、说明与创作素材，持续反馈结果数，并在无匹配时提供明确的清除入口；Browse all sources 会重置为完整
素材架。桌面端将筛选与搜索放在同一工具栏，小屏幕把搜索提升到筛选之前并允许分类横向滚动。
Home 与 Project Overview 的候选歌曲均可直接接入 Global Player；Projects、
Project Overview 与 Studio 会读取 provider-neutral 项目/候选 projection，Studio 会按
请求的 `projectRef`/`versionRef` hydration 当前版本。Create Queue 支持活动生成的取消
反馈、无可播放结果时的明确空状态和失败后的 Try again 重试入口；打开时焦点进入 Queue、背景滚动锁定，移动端使用全宽工作表；状态同步优先读取快照并通过 SSE `Last-Event-ID` 回放事件。候选方向使用可聚焦的显式选择控件和稳定选中态，不再依赖无语义的整卡点击；Create 不暴露无法分享未保存创作状态的假 Share；Studio 已巡检
Arrangement/Lyrics/Stems 切换、Preview 与真实 Copy link 反馈，只有剪贴板写入成功才显示 Link copied，失败会明确提示并可重试；移动端文字收起后仍以旋转、绿色确认和红色警告图标呈现三种状态；Export 不再点击即提交固定 MP3，而是先打开可聚焦、可按
Escape 关闭的明确工作窗，选择 Studio 当前打开的 Version 或该 Version 最新保存的 Mix Revision、MP3/WAV 与 Full song 后再提交。
异步状态覆盖 queued/processing、失败保留选择与重试、完成下载；关闭窗口后，Studio 顶栏仍用 Exporting、Export ready、Export needs attention 与对应状态图标提供返回入口；创建结果不确定时重试复用同一 Idempotency-Key，
瞬时读取失败继续跟踪原任务；snapshot 必须回显完全一致的 Project/Version/source/scope/format，错误上下文不会生成下载动作；
Studio 顶部现在提供上下文化的 Finish，而不是新增全局 AI 工具：Remaster 可从当前打开的 Version 或其最新 Mix Revision
开始，默认 Balanced，并提供 Subtle / Balanced / Bold 三档可解释强度。用户先 Review source、strength、Whole song、
五项保护约束和“两条 Take”去向，再执行已有的 version-scoped Generation；窗口关闭后任务仍被 Studio 跟踪并可重新打开。
Remaster snapshot 必须回显完全一致的 `intent`、source 与 `variation_strength`，否则整单拒收；成功结果只追加到 Take Lanes，
不会覆盖源 Version、Mix Revision 或 Current Version；390px 视口下 Studio 收敛为真正单栏，顶栏四个动作与三项工具均完整可达，
页面无横向溢出，Finish 使用可滚动工作表并将 Review / Execute footer 固定在可见区域；
Finish 的 Release 页签把发布准备保留在当前 Version：标题、说明、Private / Link only / Public、允许 Remix、Explicit content
和 Artwork 均可保存为 draft，默认 Private，且可见性与 Remix 权限互不推导。窗口只有 `Save release draft`，不存在 Publish
命令，也不会改变 Current Version。Artwork 可继续使用当前图片，或先 Review 再创建固定 1:1、无文字、四个候选的异步任务；
style 与 palette 都是 provider-neutral 枚举，创建、snapshot、SSE、取消、失败重试和候选挂接均核对当前 Version 与完整计划。
选中的图片只进入 Release draft，图片资产通过同源 media seam 读取，不进入音频 Take Lanes；音乐 Cover / Restyle 仍属于
Studio Transform。关闭并重新打开 Finish、切换 Remaster / Release 都保留草稿和运行态，切换 Version 则清除旧上下文。
Release 已在 1280×720 桌面视口验证固定 Finish 标题/页签、内部滚动、底部保存动作与 Global Player 分层；在 390×844
移动视口验证单栏堆叠、无横向溢出、底部字段可达、保存动作位于 Player 上方，并验证 Rail 展开/收起不移动工作区语义。
Arrangement 已提供 Take Lanes，可试听、选择方向并通过独立的 Project-scoped `PUT current_version` 命令提交当前版本；
Open Version、Playing、Selected Take 与 Current Version 保持分离，提交期间旧 Current 不变，响应必须精确匹配
Project/Candidate/Version/previous Current 才更新。可重试失败保留 Retry 并复用同一 Idempotency-Key，并发冲突要求刷新；
同源 Mori 代理已经转发 PUT body 与幂等 Header，Release Draft 与 Current Version 不再在浏览器边界收到 405。
该状态已在 1280×720 桌面视口巡检默认、提交中、不可重试和可重试失败反馈，以及 Take Lanes 与固定 Player 的分层；
390×844 移动视口下 Rail 默认收起，Take Lanes 宽 361px、viewport 390px，页面 `clientWidth` 与 `scrollWidth`
均为 390px，失败操作、歌曲卡和固定 Player 保持可达，浏览器无 warning/error。
Version history 已在 1440×900 验证为 Studio 第三栏，Versions 顶栏动作隐藏；在 1280×720 验证为两栏 Studio，
常驻历史隐藏且 Versions 动作可打开 386px 右侧抽屉；在 390×844 验证为单栏与全宽历史工作表，页面
`clientWidth` / `scrollWidth` 均为 390px。两种历史表面都将 Open 与 Current 独立标记；抽屉位于固定 Player
上方，打开后焦点进入 Close、锁定背景滚动，Escape / Close 后回到触发入口，浏览器无 warning/error。
Arrangement 现在提供与时间线连在一起的 Mori AI Changes：Add part、Replace section、Extend、Transform
共享同一套上下文式输入；Intro、Verse、Lift、Chorus、Outro 可直接选为 AI 操作上下文，操作范围和结果去向
始终可见；时间标尺按当前 Version 时长生成，时间线播放头与 Global Player 的 seek 状态同步，并实时标记
播放头所在段落；用户可拖动 Selection start / end 形成 Custom range，界面持续显示精确起止时间，
Replace/Transform 会把它原样映射为毫秒级 `time_range`，调整范围后旧的 Review Plan 自动失效；
每个一层任务在用户输入前都会显示一句结果导向说明，避免只凭术语猜测 Add、Replace、Extend、Transform 的差别；
`Keep & compare` 默认收起，摘要使用“kept / takes”而不是内部 anchor 术语，展开后可选择保留 Melody、Lyrics、Voice、Tempo、Structure，
可请求 1 / 2 / 4 个 alternatives；选择 Transform 后先出现 Restyle / Cover 两个命名意图，而不是继续堆叠高级参数。
Restyle 可作用于 Selected section 或 Whole song，保留用户选择的 anchors、references 与输出数量；Cover 固定使用
当前 open Version 的 Whole song，不要求重新上传，并明确声明 “Audio cover, not release artwork.”。Vocal Cover 可选
Voice profile，固定保护 Melody / Lyrics / Structure；Instrumental Cover 隐藏 Voice，并固定保护 Melody / Structure；
两种 Cover 都清空 references、固定产生两条 Take。所有选择会同时进入 Change Plan 与最终 API body；提交前先展示
可读计划，主动作按 Restyle 数量或 Cover 固定数量显示 Generate takes，并持续声明 Current version stays untouched；
浏览器会把段落宽度换算为稳定毫秒 scope，提交后显示真实 Generation
进度，允许取消或重试；切换 Arrangement、Lyrics、Stems 时仍保留运行中的 operation、instruction 与选区；
成功返回的 Candidate 追加进入 Take Lanes，既不覆盖已有 Take，也不自动替换 Current Version；
Studio Change 的浏览器契约已固定为 version-scoped generation：四种 operation 使用互斥 scope，
请求通过 `createStudioChangeRequest()` 归一为 `snake_case`，限制 1–4 个输出和最多 8 个参考资产，
并由同源 `POST /api/v1/mori/versions/{version_ref}/generations` 携带 `Idempotency-Key` 提交；
machine-readable OpenAPI 与 contract tests 会阻止 camelCase、provider、tenant 或 subject 字段进入公开 Schema；
Generation snapshot 通过 `generation_kind` 区分新歌与 Studio Change，Studio 分支保留
`source_version_ref` 和 `operation`；Restyle / Cover 分支必须精确回显已复核的 intent、scope、instruction、preserve、
references 与 output count，Cover 还必须回显 mode 与 Voice，任一字段不一致都拒绝整批 Candidate；Remaster 分支额外
保留 `intent + source + variation_strength`，刷新后仍可恢复正确上下文；
`add_part` 在保持四种一层 operation 不变的前提下增加严格的 whole-version layer 分支：`part_kind` 明确为
`vocals | instrumental`，Vocal layer 携带非空 `lyrics` 与可选 `voice_ref`，Instrumental layer 将两者固定为
`null`；OpenAPI、request builder 与 contract tests 共同约束该 provider-neutral 语义；
Transform 已在 1280×720 桌面视口巡检 intent 层级、prompt 主次、Review Plan 可读性、Take Lanes 与固定 Player 分层；
在 390×844 移动视口巡检 Restyle / Cover 单栏、Vocal Voice 选择、Cover Review Plan、Player 上方动作可达性，滚动面
`clientWidth` 与 `scrollWidth` 一致，无横向溢出或 Cover / artwork 歧义；
Lyrics 已升级为双工作面：左侧保留可编辑 Draft，右侧 Mori lyric partner 提供 Rewrite、Continue、Find rhyme、
Restructure，并能选择 Verse、Chorus 或 Whole lyrics；用户先 Review direction，再通过同源 Lyrics Revision API
获得多个独立且可编辑的 Suggestion。运行态展示 snapshot / SSE 进度，支持取消、失败保留与重试；切换 Studio 工具
不会丢失进行中的方向和选区。Apply 前原稿保持不变，只应用当前选中的 Suggestion，Apply 后可 Undo，最后仍通过
Save draft 明确持久化；BFF 离线时显示真实失败状态，不在组件内生成替代结果。该工作面已在 1280×720 下巡检
初始、Review 与离线重试状态，窄画布不再把歌词挤成逐字换行，且无浏览器运行时错误；多 Suggestion 成功态由集成测试覆盖。
Stems 已升级为当前 Version 内的非破坏式分离工作面：默认 Isolate a part 快路径可选择一个目标并返回该目标与
remaining mix；Auto split 按内容检测最多 12 个制作轨；Custom stems 要求选择 2–10 个稳定目标，未达到两个时
Review 明确禁用。三种模式共用可选 MIDI transcription，先 Review Requested、Output、Source 和结果去向，再提交异步任务。运行态通过 snapshot / SSE
显示进度并支持取消、失败重试和切换工具后恢复；成功态只渲染 API 实际返回的 version-bound stem assets，逐轨
Mute/Solo/Level 会即时作用于同步试听通道，但不修改资产或 Current Version；共享 Play/Pause、Seek、漂移校正和
逐轨下载都只使用 snapshot 返回的 asset refs，并通过支持 Range 的同源媒体 seam 读取。媒体不可用时停止整组并显示
真实错误，不使用 preview 音频顶替。用户可将完整 Gain / Mute 显式保存为不可变 Mix Revision；Solo 只属于监听态，
保存失败保留当前调整，未变化时禁用重复保存。三种 Setup、Review Plan 与成功试听态已在 1280×720 下巡检，
快路径无需额外参数页，Custom 选择通过页面正常滚动避开固定 Player，浏览器日志无运行时错误。
Stems 顶层已经收敛为 Voice & stems，并在同一上下文中提供 Separate mix、Add vocals、Add instrumental 三种意图；
不为 Tad 式能力分类继续增加全局导航。Add vocals 要求 Lyrics，将可选 Voice profile 与 Vocal direction 分开；
Add instrumental 只要求编曲方向。两者作用于 Whole song，先 Review Layer Plan，固定输出两个 alternatives 到
Take Lanes，并明确 Current Version stays untouched。未提交草稿可在三个子工作流间保留；运行中的 Vocal layer
离开并返回 Stems 后仍恢复原意图、进度和取消入口。成功 Candidate 只追加到 Arrangement 的 Take Lanes，用户
点击 Review takes in Arrangement 后仍需显式 Use take 才会改变 Current Version。
Stem Separation 的 OpenAPI、request builder、same-origin client、运行时 parser 与 contract tests 已固定
`mode + target_kinds[]` 的意图与数量不变量，以及 `snake_case`、`Idempotency-Key`、`Last-Event-ID`、cancel
和 caller identity 边界；snapshot 会回显目标，浏览器在恢复时同时核对 Version、模式、目标与 MIDI 选择；
Mix Revision 的独立 OpenAPI、request builder、same-origin client 与运行时 parser 固定 `201` 同步 command、
完整逐轨 `stem_ref + gain + muted`、不可变 revision、幂等与来源 Version/Separation 校验；
Lyrics Revision 的浏览器契约已固定为 version-scoped 异步资源：输入明确 direction、section / whole lyrics
scope、完整 lyrics context、source text、constraints 与 1–4 个输出；snapshot 返回 source digest 和文本
suggestions，支持 SSE `Last-Event-ID` 回放与幂等 cancel。OpenAPI、request builder、same-origin client、运行时
response parser 和 contract tests 会阻止 camelCase、provider 以及 caller-supplied tenant/subject/actor 字段进入边界；
Create 的 Smart 模式会先展示可编辑 Song Plan 摘要，用户确认后才持久化 Song Plan 并创建
generation；未实现的 More/Edit 死按钮已移除，避免给用户错误预期。Library 对空的版本投影
提供明确空状态，不再因为过滤器没有对应内容而渲染异常；项目列表从独立的 project projection
合并，避免真实 Library 只返回版本时丢失 Projects 视图；Projects 和 Project Overview 对成功返回的
空 project/candidate projection 也展示明确空状态，不再保留过期的 First Light fixture；Project Overview
对项目和候选 projection 分开收敛，单个投影暂时不可用时也不会把 First Light 候选错挂到实时项目上。
Create 现在在主 Prompt 下方提供 Smart / Custom 共用的 Creative sources：Audio、Voice、Inspiration 都是
可选上下文，不进入全局 Rail，也不再与页面底部快捷入口重复。Audio 打开真实文件选择，校验音频格式和
50 MB 上限，并展示文件名、大小、替换和移除操作；无效的替换不会清空已经选好的参考。选中的本地参考会通过预览资产
`reference_asset_refs` 进入 generation command。Voice profile 使用稳定 preview `voice_ref`，与 Custom
中的人类可读 Vocal direction 分开；Inspiration 采用少量策展方向并同步到仍可编辑的 Style，手动改写
Style 后会解除旧 preset 关联。Library 中的 Audio、Voice、Inspiration preview assets 可通过
`source_kind` + `source_ref` 的 provider-neutral 查询上下文进入 Create；Create 只恢复已知且类型匹配的素材，
未知或错配引用不会污染创作草稿。正式上传与实时资产 projection 仍由后续 storage/music owner adapter 承接。
没有实际参数的 Advanced 假入口已移除，Custom 只保留会影响生成请求的控制项。
Custom 模式在选择 Lyrics 时提供可选的用户歌词输入，提交时会按 `lyrics_mode` 和公共契约传递
到 generation command；切换为 Instrumental 后该输入从当前创作界面收起。
Create 的 Smart/Custom 模式使用标准 tab 键盘模型：方向键切换模式、Home/End 定位首尾，只有当前
模式进入 Tab 顺序，并通过 tabpanel 关联当前创作面板。
Projects 的 New project、Start a project 和 Start another idea 都打开 Mori 自己的项目创建窗口；
填写名称后通过 `POST /api/v1/mori/projects` 携带 `Idempotency-Key` 创建项目，成功结果提供项目入口，
不会把“新项目”误导到 First Light 预览项目。

Settings 已收敛为 Mori 自身需要的四组能力：Appearance、Playback、Creation、Account；采用
参考 Kokoro Settings 的浮窗结构（固定左侧偏好导航、右侧独立滚动内容、回到来源工作区的关闭入口），
关闭时支持遮罩点击和 Escape，并锁定背后的工作区滚动；不再把 Kokoro 的 computer、deployment、integration、team、skills、MCP 等通用能力带入
音乐产品；音乐偏好和桌面 Rail 展开状态会保存在当前浏览器中，刷新后仍保持。Create 会在偏好
hydration 完成后同步默认模式、输出类型和时长。全局 Rail 不再放置难以理解的 Current project 卡片，项目入口统一回到 Projects，
Settings 与 Help 在当前 utility 页面上会显示 active 状态，Create 从项目或 Studio 入口打开时会保留
`project_ref` 并优先读取项目名称，
具体项目上下文会在 Project Overview、Create 和 Studio 中连续保留；从任意 Mori 工作区打开 Settings 后，关闭入口会回到来源路径；请求不存在的 Studio 版本时显示明确的 unavailable 状态，不回退到 First Light fixture。
Settings 以浮动 dialog 呈现，打开后焦点进入窗口，Tab/Shift+Tab 在窗口内循环，Escape 使用同一关闭入口返回来源。
返回入口会按来源显示为 Home、Create、Projects、Project 或 Studio，并保留 Create 中的 `project_ref` 查询上下文。
Generation queue 作为带遮罩的 modal 上下文抽屉处理，打开后焦点进入队列，Tab/Shift+Tab 不会跑到遮罩后的工作区，关闭后恢复触发入口。
当实时项目没有可播放版本或 Studio 版本失效时，Global Player 保留固定 dock 的空间，但展示
Nothing playing 和下一步提示，播放、跳转、静音等依赖版本的控制会明确禁用。播放器的上一首/下一首
只在当前页面投影的候选集合内切换，不会把其他项目或旧的预览方向混入当前上下文。

本轮改动范围仅为 `kokoro-mori`；未修改 BFF、`kokoro-app` 或其他服务仓库。

## 产品边界

- 首屏歌曲、候选、波形和生成状态来自稳定 preview fixtures；Library 可读取同源 BFF 的
  provider-neutral projection，BFF 不可用时回退到确定性 fixture。
- 不执行真实音乐生成，不消耗 Suno、Tad 或其他供应商额度。
- 浏览器不直连供应商；真实接线必须通过同源 `/api/v1/*` BFF。
- Release 当前只保存 version-scoped draft，不执行公开发布；Private 是默认值，分享可见性与允许 Remix 是独立选择。
- API 请求遵守 `snake_case`、`{data, meta}` / `{error, meta}`、`meta.request_id`、
  `Idempotency-Key` 和 SSE `Last-Event-ID` 规则。

## 下一道门

API 契约见根仓库：

`docs/superpowers/specs/2026-09-02-mori-api-contract-v0.1.md`

下一阶段为 BFF 与 music owner 的真实 typed adapter；在 owner、权限、幂等 receipt 和事件
回放契约接通前，preview adapter 保持 fixture-only。
