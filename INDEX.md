# Mori 代码地图

## 入口

- `src/app/`：Next 页面路由。
- `src/features/mori/mori-workspace.tsx`：跨页面的 Mori 工作区组合。
- `src/features/mori/studio-page.tsx`：Studio 工作面与 Version 上下文。
- `src/features/mori/components/mori-app-shell.tsx`：桌面 Rail、内容面与全局 Player 壳体。

## 业务边界

- `src/features/mori/`：Mori 的 UI、浏览器状态、provider-neutral 映射与恢复 guard。
- `src/lib/mori-api.ts`、`src/lib/mori-api-client.ts`：浏览器 API 类型与同源 client。
- `src/features/mori/composition*.ts`：Composition 规则、revision command、history 与保存状态。
- `src/features/mori/generation*.ts`：Generation queue、SSE replay、取消与刷新恢复。
- `src/features/mori/creative-assets.ts`：Creative Source 的本地类型与 preview 数据。
- `contract/openapi/`：本仓浏览器 HTTP 机器契约事实源。
- `contract/tests/`：契约断言；不放跨仓 owner schema。

## 不属于本仓

Project、Version、Generation、Asset、Release 与用户身份的 durable owner 属于后续 owner 服务；Mori 只能通过固定版本契约消费，不读取别仓数据库。

详细当前状态、设计与验证见 [`docs/INDEX.md`](./docs/INDEX.md)。
