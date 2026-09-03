# Mori 浏览器契约

`contract/` 是 `kokoro-mori` 自己拥有的浏览器 HTTP 边界事实源，不复制供应商协议，也不定义
music owner、BFF 或其他 Kokoro 子仓的内部模型。

## 当前契约

- [`openapi/mori-studio-change.v1.json`](./openapi/mori-studio-change.v1.json)：Studio 中
  Add part、Replace section、Extend、Transform 的 version-scoped generation command；其中 Add part 同时覆盖
  时间线插入与 whole-Version Add Vocals / Add Instrumental 图层，Transform 的 typed `remaster` 分支覆盖
  Version / Mix Revision 来源与 Subtle / Balanced / Bold 强度，以及刷新恢复所需的 discriminated Generation snapshot。
- [`tests/mori-studio-change.contract.test.ts`](./tests/mori-studio-change.contract.test.ts)：检查路径、
  幂等 Header、operation/scope 对应关系、`generation_kind` 快照分支、`snake_case` 与
  provider-neutral 边界。
- [`openapi/mori-lyrics-revision.v1.json`](./openapi/mori-lyrics-revision.v1.json)：Lyrics 中
  Rewrite、Continue、Find rhyme、Restructure 的 version-scoped 异步文本 Revision，以及 snapshot、
  SSE replay 与 cancel。
- [`tests/mori-lyrics-revision.contract.test.ts`](./tests/mori-lyrics-revision.contract.test.ts)：检查 Direction、
  Section / Whole lyrics scope、Constraint、幂等命令、恢复资源与受信身份边界。
- [`openapi/mori-stem-separation.v1.json`](./openapi/mori-stem-separation.v1.json)：Stems 中
  Isolate part、Auto split、Custom stems 与可选 MIDI 的 version-scoped 异步分离资源，以及 snapshot、
  SSE replay 与 cancel；`target_kinds` 明确承载用户要求的音轨，而不是供应商私有乐器 ID。
- [`tests/mori-stem-separation.contract.test.ts`](./tests/mori-stem-separation.contract.test.ts)：检查来源 Version、
  provider-neutral 分离模式、幂等命令、返回资产、恢复资源与受信身份边界。
- [`openapi/mori-media-access.v1.json`](./openapi/mori-media-access.v1.json)：浏览器使用 opaque
  `asset_ref` 进行同源音频播放、图片读取与显式下载；音频支持 byte-range，边界不暴露对象存储位置或供应商 URL。
- [`tests/mori-media-access.contract.test.ts`](./tests/mori-media-access.contract.test.ts)：检查 `Range` / `If-Range`、
  音频和图片的 `200`、仅音频允许的 `206`、inline / attachment、授权错误与 provider-neutral 边界。
- [`openapi/mori-mix-revision.v1.json`](./openapi/mori-mix-revision.v1.json)：把一次完成的 Stem Separation
  上的逐轨 Gain / Mute 保存成 version-scoped、不可变的 Mix Revision；Solo 明确只属于试听态。
- [`tests/mori-mix-revision.contract.test.ts`](./tests/mori-mix-revision.contract.test.ts)：检查 `201` 创建、读取资源、
  幂等 Header、完整音轨集合、`snake_case` 与 provider-neutral 边界。
- [`openapi/mori-export.v1.json`](./openapi/mori-export.v1.json)：从路径 Version 或该 Version 的 Mix Revision
  创建异步全曲渲染；请求显式携带 source、scope 与 MP3/WAV format，snapshot 回显完整渲染上下文。
- [`tests/mori-export.contract.test.ts`](./tests/mori-export.contract.test.ts)：检查 `202` 创建、幂等 Header、
  Version / Mix Revision 来源分支、仅已实现的 full-song scope、异步读取与 provider-neutral 边界。
- [`openapi/mori-artwork-generation.v1.json`](./openapi/mori-artwork-generation.v1.json)：从路径 Version
  创建异步 Release artwork；固定方形、无文字和四个候选，并提供 snapshot、SSE replay 与 cancel。
- [`tests/mori-artwork-generation.contract.test.ts`](./tests/mori-artwork-generation.contract.test.ts)：检查四种 style、
  四种 palette、固定输出约束、Version 回显、图片 asset refs、幂等命令和受信身份边界。
- [`openapi/mori-release-draft.v1.json`](./openapi/mori-release-draft.v1.json)：读取或保存 version-scoped Release
  draft；标题、说明、可见性、Remix 权限、Explicit content 与 Artwork 均为显式字段，并使用 revision 做乐观并发。
- [`tests/mori-release-draft.contract.test.ts`](./tests/mori-release-draft.contract.test.ts)：检查 `GET` / `PUT`、
  `expected_revision`、draft-only 状态、独立可见性与 Remix 权限，以及 provider-neutral 边界。

Studio Change 不建立第二套异步任务状态机。它通过
`POST /api/v1/mori/versions/{version_ref}/generations` 创建既有 Generation 资源，并继续复用
Generation snapshot、SSE replay、cancel 和 Candidate 输出。这样 Create 与 Studio 都产生 Candidate，
但入口上下文和请求 Schema 各自保持明确。

Add Vocals / Add Instrumental 仍是 `add_part` 的二层意图，不扩张 Studio 的一层 operation 集合。时间线插入继续
使用 `insertion_point`；整首图层使用 `whole_version`，并显式携带 `part_kind`、`lyrics` 与 `voice_ref`。
Vocal layer 要求非空歌词，Voice profile 可选；Instrumental layer 的 `lyrics` 与 `voice_ref` 固定为 `null`。
两者都从路径中的不可变 Version 取源，默认输出两个 Candidate 到 Take Lanes。

Remaster 仍属于稳定一层操作 `transform`，但使用严格的 `intent: remaster` 二层分支。它固定
`whole_version` scope、两条输出与 Melody / Lyrics / Vocal identity / Tempo / Structure 五项保护约束；
`source` 可指向路径中的 Version，或该 Version 已保存的 Mix Revision；`variation_strength` 为
`subtle | balanced | bold`。这样 Finish 能表达“精修当前作品”而不与自由 Restyle 混淆，也不新增另一套 job。

`GET /api/v1/mori/generations/{generation_ref}` 通过 `generation_kind` 区分 `new_song` 与
`studio_change`。Studio 快照必须返回 `source_version_ref` 和 `operation`；Remaster 快照还必须原样回显
`intent`、`source` 与 `variation_strength`。页面刷新后不依赖
内存中的表单状态，也能恢复正确的来源、操作与进度。

Lyrics Revision 不混入音频 Generation：它输出可编辑的文本 Suggestion，而不是 Candidate/Take。
`POST /api/v1/mori/versions/{version_ref}/lyrics_revisions` 接收当前完整 `lyrics_context`、显式 section
line range / whole-lyrics scope、source text、direction、constraints 与输出数量；snapshot 返回
`source_digest` 和 Suggestion refs，便于消费者在 Apply 前判断原 Draft 是否已经变化。Section line range
相对归一化后的 `lyrics_context` 使用从 0 开始、左闭右开的索引。浏览器不提交 tenant、subject、actor 或供应商字段。

Stem Separation 同样不伪装成 Generation Candidate。它从一个不可变 Version 创建可复用音轨资产，
`POST /api/v1/mori/versions/{version_ref}/stem_separations` 接收 `mode`、`target_kinds` 与 `include_midi`：
`isolate_part` 要求一个目标，`auto_stems` 不接受手选目标，`custom_stems` 要求两个至十个唯一目标；snapshot
回显来源 Version、完整意图、进度、`source_audio_digest`、实际生成的 stems 与可选 MIDI asset。浏览器中的
Stem mixer 只读取 snapshot 返回的 `audio_asset_ref`，通过同源媒体投影同步试听，并把 Mute、Solo 与 Level
即时应用到浏览器播放通道。用户明确 Save 后，浏览器把完整逐轨 Gain / Mute 作为新的不可变 Mix Revision
提交；Solo 只影响当前试听，不进入持久化模型。保存既不修改 stem asset，也不覆盖 Current Version。

`POST /api/v1/mori/versions/{version_ref}/mix_revisions` 是同步 metadata command，成功返回 `201`，不伪装成
音频渲染任务。owner 必须确认 `source_stem_separation_ref` 属于路径 Version，并要求 `tracks` 与该 separation
实际返回的 stem 集合完全一致；相同幂等键重放同一个结果，改动后的再次保存创建下一个 revision。

`POST /api/v1/mori/versions/{version_ref}/exports` 是异步音频渲染 command，成功返回 `202`。`source.type`
区分路径中的 Version 与已保存 Mix Revision；Mix Revision ref 必须归属路径 Version。当前 `scope` 只发布实际可用的
`full_song`，不提前暴露尚无时间选区或多轨交付语义的死选项。`GET /exports/{export_ref}` 回显 Version、source、
scope 与 format，浏览器连同 Project 上下文阻止错误轮询结果被挂到当前 Studio；只有 succeeded snapshot 携带 download URL。
创建响应不确定时消费者必须复用原 `Idempotency-Key`；状态读取的瞬时失败不得创建第二个 render task。

Artwork Generation 是 Release 的视觉身份流程，不是音乐 Cover / Restyle，也不复用音频 Generation 或 Take Lanes。
`POST /api/v1/mori/versions/{version_ref}/artwork_generations` 固定 `aspect_ratio: 1:1`、`text_policy: no_text`
与 `output_count: 4`，并显式携带 prompt、style 和 palette。消费者必须先 Review 再创建，使用 durable snapshot、
SSE replay、cancel 与同一幂等键重试；只有 Version 和完整计划均匹配的成功 snapshot 才能提供可选图片。

`GET|PUT /api/v1/mori/versions/{version_ref}/release_draft` 只管理草稿，不包含 Publish command。新草稿默认由
界面选择 `private`，`visibility`、`allow_remix` 与 `explicit_content` 各自独立；Artwork 可以继续使用当前图片，
也可以引用已生成的 `artwork_candidate_ref`。更新必须携带 `expected_revision`，返回的 Version、revision 和完整
draft 必须与请求上下文一致，防止旧窗口或错误资源覆盖当前选择。

`GET /api/v1/mori/assets/{asset_ref}/content` 是浏览器媒体读取 seam，不是第二份 Asset 事实源。BFF 必须从
受信会话与资源关联完成授权，再向 Storage owner 解析对象字节；浏览器不能提交 tenant/subject，也不能得到
bucket、对象 key 或供应商签名 URL。音频播放默认使用 `inline` 并允许单一 byte range；Release 图片使用完整
`image/*` 的 `200` 响应；明确下载使用
`disposition=attachment`。Next 同源代理透传 `Range`、`If-Range`、`206` 与内容范围响应头。

`src/lib/mori-api.ts` 和 `src/lib/mori-api-client.ts` 是当前浏览器消费者实现。契约变更顺序固定为：

```text
contract -> contract tests -> browser types/client -> component seam -> integration/smoke
```
