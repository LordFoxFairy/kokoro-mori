# Mori 代码地图

> 仅描述 `kokoro-mori` 子仓库；不包含 Root、BFF 或其他 Kokoro 服务的业务事实。

## 运行边界

- Mori 拥有音乐产品的页面组合、浏览器交互状态、Studio 体验和 provider-neutral 的请求映射。
- `kokoro-web-shared` 通过已发布的 `@kokoro/i18n`、`@kokoro/web-core` 与 `@kokoro/tsconfig` package 复用通用 Web 基础能力。
- 真实项目、Generation、Asset 和鉴权事实不在本仓库持久化；浏览器边界通过同源 Mori API client 接入。

## 目录与 owner

```text
src/app/                         Next.js 路由入口与页面装配
src/features/mori/domain.ts      Candidate、Project、Version、生成状态等产品类型
src/features/mori/               Mori 页面、组件、交互状态与 fixture projection
  components/                    全局 Rail、Player、Queue、Studio 工作面
  creative-assets.ts              本地 preview Creative source projection 与 UI 映射类型
  studio-change.ts                Studio Change 领域计划与 scope 计算
  studio-recovery.ts              从服务端 Generation snapshot 恢复 Studio Change 工作上下文
  generation-queue-storage.ts    Generation queue 的浏览器持久化边界与跨 surface 通知
  *-page.tsx / *-workspace.tsx    页面级组合和 API 状态编排
src/lib/mori-api.ts              Mori wire type、Library/Creative Source projection、请求 builder 与同源 client seam
contract/openapi/                本仓 Studio / release 等机器契约事实源
test/                             跨组件与契约测试（若新增独立测试目录则按 unit/contract 归类）
```

## 依赖方向

```text
app route -> Mori page/workspace -> components + feature state
feature request builder -> src/lib/mori-api.ts -> same-origin client
components -> domain / feature models
domain -> 不依赖 Next.js、React DOM、provider SDK 或数据库
```

修改跨边界行为时，先检查 `src/lib/mori-api.ts` 与对应 OpenAPI，再更新 feature state、组件和测试；不要在组件中拼接 provider 字段或直接访问 BFF 数据库。
