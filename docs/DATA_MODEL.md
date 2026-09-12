# Mori 数据边界

## 当前结论

本仓**无持久化 owner**，因此不创建数据库 schema、ORM model、migration 或空 SQL 测试。Project、Version、Generation、Asset、Release、Identity 与 Billing 事实属于后续 owner 服务。

## 浏览器侧状态

| 状态 | 当前承载 | 语义 |
|---|---|---|
| Project/Version projection | API response + React state | 远端事实的只读投影，不是本地 owner |
| Open Version / Song Plan / Lyrics Draft command | owner-confirmed response + recovery command | 需要 revision、幂等与冲突确认 |
| Generation queue 摘要 | 浏览器受限存储 | 只存 ref、状态、进度、cursor 等摘要，不存 prompt、provider payload 或音频字节 |
| Composition history | 当前 Studio 内存状态 | 待 owner projection 接入的可编辑 revision foundation |
| Player queue | 浏览器播放状态 | 试听上下文，不改变 Current Version |
| Preview data | 静态本地 fixture | 仅在 owner projection unavailable 时展示，并必须标注 Preview |

## 约束

- Candidate、Version、Source、Asset 的 ref 必须被当前 Project/Version 上下文校验。
- 不把 Open Version 偏好当作 Project Current；Current 只能通过 CAS command 更新。
- 真实持久化接入时由 owner 提供 schema、事务、retention、幂等 receipt 与 recovery smoke；Mori 只更新对应 client/adapter。
