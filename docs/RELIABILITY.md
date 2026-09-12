# Mori 可靠性方案

## 异步任务

Generation、Lyrics Revision、Stem Separation、Artwork 与 Export 均通过 snapshot + replay + cancel 表达生命周期。页面卸载、切换 Version 或网络断开会中止读取，但不会丢弃可重试 command。

## 恢复与一致性

- 不确定的创建响应复用原 `Idempotency-Key`，不盲目创建第二个任务。
- URL 中的 `generation_ref`、Project/Version ref 是恢复入口；本地队列为空也能尝试 owner snapshot。
- 每个前台任务带 epoch/context guard，迟到事件不能覆盖当前 Version。
- Revisioned workspace 与 Composition 保存只有收到完整、匹配的 owner projection 才显示成功。
- 试听、选择 Take、打开 Studio 与设为 Current 互相隔离；播放状态不因页面 projection 暂时失败而清空。

## 可观测性待接入

当前 preview 仓库不拥有服务端指标。真实 owner 接入时必须提供 request id、trace id、状态转移、耗时、重试、取消、冲突与 provider failure 的结构化观测，并以 integration/smoke 证明。
