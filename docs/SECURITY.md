# Mori 安全边界

- Mori 不持久保存 provider token、密码或音频字节；用户先由 Product 建立原生会话，Mori 不新增登录、换票或 Session store。
- issuer 的普通／secure Cookie 是会话边界；只转发 `session_token`、`session_data`、`dont_remember` 两种前缀的六个 cookie，
  不转发任意 cookie 或采信浏览器自报 principal／tenant／service。服务端固定 Origin、`web-bff` 与内部凭据。
- 唯一三配置为 `KOKORO_BFF_BASE_URL`、`KOKORO_INTERNAL_SECRET_WEB_BFF`、`KOKORO_WEB_ORIGIN`；secret 只留服务端，
  缺配置 fail closed，loopback 不启用隐式 fixture／旧 namespace／固定 principal；测试显式提供自己的 peer 配置。
- 浏览器只提交当前 Project/Version 与契约允许的字段；tenant、actor、subject、provider 字段不可由用户输入。
- 音频、图片和下载使用 opaque `asset_ref` 的同源媒体 seam；不向浏览器暴露对象存储位置或供应商 URL。
- 写操作遵守同源 CSRF 防护、权限错误收敛与资源范围校验；错误中不回显 SQL、堆栈、请求原文或 secret。
- Upload/Reference 只允许契约声明的类型、大小和扫描状态；失败保留可重试上下文而不伪造 ready。
- 日志与浏览器状态只记录 ref、状态、request id 等必要摘要，不记录 prompt、歌词全文或 provider payload。
- Studio 的 stale response guard 防止旧 Project/Version/Generation 响应污染当前工作面；所有跨版本操作均重新校验上下文。

## R-05 传输边界

普通请求体最多 1 MiB／读取 5 秒，普通请求含响应体总期限 30 秒；仅 creative-source content PUT 按既有音频能力
保留 50 MiB／读取 120 秒，其后 JSON 回执阶段 30 秒。媒体／SSE 首部 30 秒、等待上游读取时闲置 60 秒，
不把普通短总期限或下游背压当媒体失效。取消贯穿读取／fetch／response body，并回收对应 timer／listener／reader。
写入超时不证明 owner 回滚，不自动重试；保留原幂等身份与未知结果。原字节、Range 与 If-Range 不经 JSON 重编码。

这些限制是 Mori adapter 的局部边界，不声明当前 BFF 已提供上传／媒体 owner 映射；preview 和未接入能力仍显式保留。
