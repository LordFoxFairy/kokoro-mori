# Mori

Mori 是 Kokoro 的专业 AI 音乐创作工作区：Create 负责形成歌曲方向，Project 负责承接作品记忆，Studio 负责继续编辑、比较 Take、完成与发布。

## 本地启动

```bash
pnpm install --frozen-lockfile
pnpm dev
```

运行时要求 Node `>=22 <23`。当前仓库是浏览器 preview 与同源 adapter，不直接连接数据库、对象存储或第三方 provider。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

入口与设计文档见 [`INDEX.md`](./INDEX.md) 和 [`docs/INDEX.md`](./docs/INDEX.md)。
