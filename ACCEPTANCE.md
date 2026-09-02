# Mori Preview Acceptance

> 记录日期：2026-09-02
> 范围：Mori 第一轮全局壳体、页面 IA、fixture-only 生成体验与 API client seam

## 验证命令

在 `kokoro-mori` 根目录执行：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

最近一次完整门禁结果：

- `pnpm lint`：通过，`--max-warnings=0`
- `pnpm typecheck`：通过
- `pnpm test`：通过，7 个测试文件、17 个测试
- `pnpm build`：通过，生成 `/`、`/create`、`/projects`、`/library`、Project Overview 和 Studio 路由

## 页面巡检

本地启动：

```bash
pnpm dev --hostname 127.0.0.1 --port 3001
```

已巡检以下页面：

```text
/
/create
/projects
/projects/project_preview_first_light
/projects/project_preview_first_light/studio/version_preview_first_light_a
/library
```

每个页面均存在 Mori Rail 和 Global Player，且没有 Next Runtime Error。Create 的 Queue
默认关闭，可通过 Queue 动作打开并通过 Close generation queue 关闭；移动端 390px 视口
默认收起 Rail，内容仍保持可见。

## 产品边界

- 所有歌曲、候选、波形和生成状态均来自稳定 preview fixtures。
- 不执行真实音乐生成，不消耗 Suno、Tad 或其他供应商额度。
- 浏览器不直连供应商；真实接线必须通过同源 `/api/v1/*` BFF。
- API 请求遵守 `snake_case`、`{data, meta}` / `{error, meta}`、`meta.request_id`、
  `Idempotency-Key` 和 SSE `Last-Event-ID` 规则。

## 下一道门

API 契约见根仓库：

`docs/superpowers/specs/2026-09-02-mori-api-contract-v0.1.md`

下一阶段为 BFF 与 music owner 的真实 typed adapter；在 owner、权限、幂等 receipt 和事件
回放契约接通前，preview adapter 保持 fixture-only。
