# Mori 浏览器契约

`contract/` 是 `kokoro-mori` 自己拥有的浏览器 HTTP 边界事实源，不复制供应商协议，也不定义
music owner、BFF 或其他 Kokoro 子仓的内部模型。

## 当前契约

- [`openapi/mori-studio-change.v1.json`](./openapi/mori-studio-change.v1.json)：Studio 中
  Add part、Replace section、Extend、Transform 的 version-scoped generation command，以及刷新恢复所需的
  discriminated Generation snapshot。
- [`tests/mori-studio-change.contract.test.ts`](./tests/mori-studio-change.contract.test.ts)：检查路径、
  幂等 Header、operation/scope 对应关系、`generation_kind` 快照分支、`snake_case` 与
  provider-neutral 边界。
- [`openapi/mori-lyrics-revision.v1.json`](./openapi/mori-lyrics-revision.v1.json)：Lyrics 中
  Rewrite、Continue、Find rhyme、Restructure 的 version-scoped 异步文本 Revision，以及 snapshot、
  SSE replay 与 cancel。
- [`tests/mori-lyrics-revision.contract.test.ts`](./tests/mori-lyrics-revision.contract.test.ts)：检查 Direction、
  Section / Whole lyrics scope、Constraint、幂等命令、恢复资源与受信身份边界。

Studio Change 不建立第二套异步任务状态机。它通过
`POST /api/v1/mori/versions/{version_ref}/generations` 创建既有 Generation 资源，并继续复用
Generation snapshot、SSE replay、cancel 和 Candidate 输出。这样 Create 与 Studio 都产生 Candidate，
但入口上下文和请求 Schema 各自保持明确。

`GET /api/v1/mori/generations/{generation_ref}` 通过 `generation_kind` 区分 `new_song` 与
`studio_change`。Studio 快照必须返回 `source_version_ref` 和 `operation`，因此页面刷新后不依赖
内存中的表单状态，也能恢复正确的来源、操作与进度。

Lyrics Revision 不混入音频 Generation：它输出可编辑的文本 Suggestion，而不是 Candidate/Take。
`POST /api/v1/mori/versions/{version_ref}/lyrics_revisions` 接收当前完整 `lyrics_context`、显式 scope、
source text、direction、constraint 与输出数量；snapshot 返回 `source_digest` 和 Suggestion refs，便于
消费者在 Apply 前判断原 Draft 是否已经变化。浏览器不提交 tenant、subject、actor 或供应商字段。

`src/lib/mori-api.ts` 和 `src/lib/mori-api-client.ts` 是当前浏览器消费者实现。契约变更顺序固定为：

```text
contract -> contract tests -> browser types/client -> component seam -> integration/smoke
```
