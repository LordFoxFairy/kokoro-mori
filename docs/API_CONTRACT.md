# Mori API 契约边界

## Owner 与可见性

`kokoro-mori/contract/openapi/` 是 Mori 浏览器 HTTP 边界的事实源，当前主要是 `browser-private` 同源 adapter 契约。它不复制 BFF public contract、owner RPC 或 provider 协议。

契约变更顺序固定为：

```text
contract -> contract test -> browser type/client -> component seam -> integration/smoke
```

## 已有契约族

- Library / Creative Source：版本与来源的分页投影、source deep link。
- Studio Change / Lyrics Revision / Stem Separation：Version-scoped 异步任务、snapshot、SSE replay、cancel。
- Composition：Version-scoped GET/PUT projection，带 `revision` 与 `Idempotency-Key` 的确定性、显式 `track_ref` 编辑 command。
- Project Workspace / Current Version：Project memory 与 compare-and-set 写入。
- Media / Export / Mix：opaque asset 读取、Mix Revision 与异步渲染。
- Artwork / Release Draft / Release Publish：完成态视觉、草稿与发布边界。

每个文件的字段、路径和错误断言以 `contract/openapi/*.json` 与 `contract/tests/*` 为准；本文不维护第二份字段列表。

## 通用规则

- HTTP 路径使用显式 `/v1` 与名词资源；JSON 使用 `snake_case`。
- 成功响应使用 `{ "data": ... }`；错误使用稳定 `code`、`message`、`retryable` 与可选 `details`。
- 写操作按契约使用 `Idempotency-Key`；有并发语义时使用 `expected_revision` 或 compare-and-set。
- 分页使用 opaque cursor/limit；cursor 不承担身份或授权语义。
- tenant、actor、subject 与 provider 身份来自受信上下文，不从 body 自报。
- 浏览器只接触 opaque ref；不暴露 bucket、object key、签名 URL 或 provider payload。

## 同源 Adapter 信任边界

- `/api/v1/mori/*` 只把浏览器请求转发到配置的 BFF；认证使用同源请求携带的 `kokoro_session` Cookie，浏览器提交的
  principal / tenant / service header 不会被采信。
- Adapter 为每次请求透传或生成 `x-kokoro-request-id`，并在响应中返回 `x-request-id`；该 ID 只用于链路追踪，不承载身份。
- `KOKORO_BFF_SHARED_SECRET` 与 `KOKORO_BFF_NAMESPACE` 是服务端配置。未配置时仅允许 loopback 本地 fixture 使用本地默认值；
  非本地 BFF 缺少信任配置会 fail closed，并返回 `mori_bff_misconfigured`。
- `KOKORO_BFF_PRINCIPAL_ID` 只有服务端显式配置时才会成为内部 header，默认不合成固定 principal。

## 版本与验收

当前为 clean-slate 浏览器契约。稳定对外契约发生 breaking change 时重新评审版本与消费者切换；不建立长期 alias/fallback 双轨。契约变更必须验证 schema、错误、幂等、权限、序列化与适用的恢复路径。
