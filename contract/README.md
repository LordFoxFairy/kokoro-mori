# Mori 浏览器契约

`contract/` 是 `kokoro-mori` 自己拥有的浏览器 HTTP 边界事实源，不复制供应商协议，也不定义
music owner、BFF 或其他 Kokoro 子仓的内部模型。

## 当前契约

- [`openapi/mori-studio-change.v1.json`](./openapi/mori-studio-change.v1.json)：Studio 中
  Add part、Replace section、Extend、Transform 的 version-scoped generation command；其中 Add part 同时覆盖
  时间线插入与 whole-Version Add Vocals / Add Instrumental 图层，以及刷新恢复所需的 discriminated Generation snapshot。
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
  `asset_ref` 进行同源音频播放与显式下载的 byte-range 读取边界，不暴露对象存储位置或供应商 URL。
- [`tests/mori-media-access.contract.test.ts`](./tests/mori-media-access.contract.test.ts)：检查 `Range` / `If-Range`、
  `200` / `206`、inline / attachment、授权错误与 provider-neutral 边界。
- [`openapi/mori-mix-revision.v1.json`](./openapi/mori-mix-revision.v1.json)：把一次完成的 Stem Separation
  上的逐轨 Gain / Mute 保存成 version-scoped、不可变的 Mix Revision；Solo 明确只属于试听态。
- [`tests/mori-mix-revision.contract.test.ts`](./tests/mori-mix-revision.contract.test.ts)：检查 `201` 创建、读取资源、
  幂等 Header、完整音轨集合、`snake_case` 与 provider-neutral 边界。

Studio Change 不建立第二套异步任务状态机。它通过
`POST /api/v1/mori/versions/{version_ref}/generations` 创建既有 Generation 资源，并继续复用
Generation snapshot、SSE replay、cancel 和 Candidate 输出。这样 Create 与 Studio 都产生 Candidate，
但入口上下文和请求 Schema 各自保持明确。

Add Vocals / Add Instrumental 仍是 `add_part` 的二层意图，不扩张 Studio 的一层 operation 集合。时间线插入继续
使用 `insertion_point`；整首图层使用 `whole_version`，并显式携带 `part_kind`、`lyrics` 与 `voice_ref`。
Vocal layer 要求非空歌词，Voice profile 可选；Instrumental layer 的 `lyrics` 与 `voice_ref` 固定为 `null`。
两者都从路径中的不可变 Version 取源，默认输出两个 Candidate 到 Take Lanes。

`GET /api/v1/mori/generations/{generation_ref}` 通过 `generation_kind` 区分 `new_song` 与
`studio_change`。Studio 快照必须返回 `source_version_ref` 和 `operation`，因此页面刷新后不依赖
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

`GET /api/v1/mori/assets/{asset_ref}/content` 是浏览器媒体读取 seam，不是第二份 Asset 事实源。BFF 必须从
受信会话与资源关联完成授权，再向 Storage owner 解析对象字节；浏览器不能提交 tenant/subject，也不能得到
bucket、对象 key 或供应商签名 URL。播放默认使用 `inline` 并允许单一 byte range；明确下载使用
`disposition=attachment`。Next 同源代理透传 `Range`、`If-Range`、`206` 与内容范围响应头。

`src/lib/mori-api.ts` 和 `src/lib/mori-api-client.ts` 是当前浏览器消费者实现。契约变更顺序固定为：

```text
contract -> contract tests -> browser types/client -> component seam -> integration/smoke
```
