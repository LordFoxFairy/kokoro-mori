# Mori SLO 基线

本文件记录待以真实运行数据验证的目标，不把目标值当作实测结果。preview Web 仓库当前没有服务端流量与 provider 延迟证据。

| 面向 | 初始目标 | 证据 |
|---|---|---|
| Shell 首屏可交互 | 本地 build 后无阻塞级 console/error | Playwright smoke + browser console |
| 同源读取失败 | 有明确 unavailable/retry，不静默展示旧事实 | component/integration test |
| 异步任务恢复 | 刷新后按 ref 恢复或显示可操作失败 | replay/recovery test |
| 写入安全 | 重试不重复副作用，冲突不静默覆盖 | contract + owner integration |
| 播放控制 | seek、pause、ended 与真实媒体状态一致 | media integration/smoke |

provider、BFF、Storage 的可用性、延迟与错误预算由各 owner 仓库定义；Mori 只消费其版本化 SLO/health 契约。
