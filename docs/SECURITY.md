# Mori 安全边界

- Mori 不保存 secret、provider token、密码或音频字节；登录 session 由同源 HttpOnly 边界负责。
- 浏览器只提交当前 Project/Version 与契约允许的字段；tenant、actor、subject、provider 字段不可由用户输入。
- 音频、图片和下载使用 opaque `asset_ref` 的同源媒体 seam；不向浏览器暴露对象存储位置或供应商 URL。
- 写操作遵守同源 CSRF 防护、权限错误收敛与资源范围校验；错误中不回显 SQL、堆栈、请求原文或 secret。
- Upload/Reference 只允许契约声明的类型、大小和扫描状态；失败保留可重试上下文而不伪造 ready。
- 日志与浏览器状态只记录 ref、状态、request id 等必要摘要，不记录 prompt、歌词全文或 provider payload。
- Studio 的 stale response guard 防止旧 Project/Version/Generation 响应污染当前工作面；所有跨版本操作均重新校验上下文。
