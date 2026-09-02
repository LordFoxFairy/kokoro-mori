# Mori Preview Acceptance

> 记录日期：2026-09-02
> 范围：Mori 第一轮全局壳体、页面 IA、fixture-only 生成体验、Library/Studio 交互与 API client seam

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
- `pnpm test`：通过，13 个测试文件、47 个测试
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

每个页面均存在 Mori Rail 和 Global Player，且没有 Next Runtime Error。Global Player 是
跨页面、跨 Rail 的固定底部 transport dock；桌面端提供歌曲、波形、进度和 transport，
小屏幕收敛为歌曲信息、播放和队列入口。Create 的 Queue 默认关闭，可通过 Queue 动作
打开并通过 Close generation queue 关闭；移动端 390px 视口默认收起 Rail，内容仍保持可见。

Library 已巡检 All、Versions、Lyrics、Exports 过滤器，以及版本 Play/Pause、项目和
Studio 链接。Home 与 Project Overview 的候选歌曲均可直接接入 Global Player；Projects
与 Project Overview 会读取 provider-neutral 项目/候选 projection。Create Queue 支持
活动生成的取消反馈；状态同步优先读取快照并通过 SSE `Last-Event-ID` 回放事件。Studio 已巡检 Arrangement/Lyrics/Stems 切换、Preview、Share 反馈
和 Export queued → completed download action；未实现的 More/Edit 死按钮已移除，避免给
用户错误预期。

## 产品边界

- 首屏歌曲、候选、波形和生成状态来自稳定 preview fixtures；Library 可读取同源 BFF 的
  provider-neutral projection，BFF 不可用时回退到确定性 fixture。
- 不执行真实音乐生成，不消耗 Suno、Tad 或其他供应商额度。
- 浏览器不直连供应商；真实接线必须通过同源 `/api/v1/*` BFF。
- API 请求遵守 `snake_case`、`{data, meta}` / `{error, meta}`、`meta.request_id`、
  `Idempotency-Key` 和 SSE `Last-Event-ID` 规则。

## 下一道门

API 契约见根仓库：

`docs/superpowers/specs/2026-09-02-mori-api-contract-v0.1.md`

下一阶段为 BFF 与 music owner 的真实 typed adapter；在 owner、权限、幂等 receipt 和事件
回放契约接通前，preview adapter 保持 fixture-only。
