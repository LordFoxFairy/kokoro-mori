# Mori

Mori 是 Kokoro 的专业 AI 音乐创作工作区：Create 负责形成歌曲方向，Project 负责承接作品记忆，Studio 负责继续编辑、比较 Take、完成与发布。

## 本地启动

```bash
pnpm install --frozen-lockfile
pnpm dev
```

运行时要求 Node `>=22 <23`。当前仓库是浏览器 preview 与同源 adapter，不直接连接数据库、对象存储或第三方 provider。

## Product 会话与 BFF 配置

正式访问以用户已在 Product 建立原生会话为前提，Mori 不新增独立登录或换票；独立冷登录未做。
服务端必须显式配置 `KOKORO_BFF_BASE_URL`、`KOKORO_INTERNAL_SECRET_WEB_BFF`、`KOKORO_WEB_ORIGIN`；
缺失即 fail closed，loopback 也没有 fixture secret、namespace 或固定 principal 默认值。测试 peer 使用测试显式配置，
不因本地地址自动启用。原生 issuer Cookie 只由同源浏览器带入，不把 secret 配置到浏览器或仓库。

preview 继续明确保留。Mori 上传 seam 的 50 MiB 传输上限不表示当前 BFF 已有上传／媒体 owner 映射，
不以 adapter 局部验证冒充真实媒体、持久化或完整产品链验收。相关边界见 [`API_CONTRACT`](./docs/API_CONTRACT.md)。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

入口与设计文档见 [`INDEX.md`](./INDEX.md) 和 [`docs/INDEX.md`](./docs/INDEX.md)。
