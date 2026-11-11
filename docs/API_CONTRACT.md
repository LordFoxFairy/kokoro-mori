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

### R-05 局部决定（2026-11-11）

本次只更新认证描述与 adapter 的传输边界，既有 API／业务 owner、业务字段与数据 Schema 不变。
用户先在 Product 建立原生会话；Mori 不新增独立登录／换票，独立冷登录未做。

- 七份已有会话声明的机器契约以 `productSession`／`productSecureSession` 两个可替代 cookie scheme 表达
  `kokoro-issuer.session_token` 或 `__Secure-kokoro-issuer.session_token`，不是两者同时必需；不建立 Mori 专属会话。
- adapter 仅转发 issuer 的 regular／secure `session_token`、`session_data`、`dont_remember` 六个 cookie；
  不采信浏览器提交的 principal／tenant／service 身份。Origin 与服务凭据由服务端配置固定，不从请求伪造。
- 唯一三配置是 `KOKORO_BFF_BASE_URL`、`KOKORO_INTERNAL_SECRET_WEB_BFF`、`KOKORO_WEB_ORIGIN`。
  缺失即 fail closed；不按 loopback 自动启用 fixture，不发送旧 namespace／环境 principal。
- Adapter 透传或生成 request ID，在响应中返回 `x-request-id`，不把它用作身份。
- 普通 body 上限 1 MiB／读取 5 秒，普通调用含响应体总期限 30 秒；仅 creative-source content PUT 保留
  50 MiB／读取 120 秒，之后 JSON 回执阶段 30 秒。媒体／SSE 首部 30 秒、等待上游读取时空闲 60 秒，不设普通短总期限。
- 取消沿读取／fetch／响应流传播；Range、If-Range、Last-Event-ID、原字节、状态和幂等键保持。
  写入超时仍可能是未知结果，不自动重试或生成新幂等身份。

50 MiB 只描述 Mori 上传 seam 的传输上限；当前 BFF 没有相应上传／媒体映射，不据此宣称已启用真实 owner 链。
preview 不改为伪造的用户事实，fixture 由测试显式配置，生产不提供隐式 fixture 默认值。

## 版本与验收

当前为 clean-slate 浏览器契约。稳定对外契约发生 breaking change 时重新评审版本与消费者切换；不建立长期 alias/fallback 双轨。契约变更必须验证 schema、错误、幂等、权限、序列化与适用的恢复路径。
