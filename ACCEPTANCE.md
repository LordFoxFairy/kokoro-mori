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
- `pnpm test`：通过，15 个测试文件、82 个测试
- `pnpm build`：通过，生成 `/`、`/create`、`/projects`、`/library`、`/settings`、Project Overview 和 Studio 路由

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
/settings
```

每个页面均存在 Mori Rail 和 Global Player，且没有 Next Runtime Error。Web 桌面端采用
类似 Codex 的整高固定 Rail + 内容面布局，展开状态不再使用悬浮窗口；Rail 折叠按钮位于
品牌行内，桌面宽度下始终可见。Global Player 是跨页面、跨 Rail 的固定底部 transport
dock；桌面端提供歌曲、波形、进度和 transport，小屏幕收敛为歌曲信息、播放和队列入口。
Create 的 Queue 默认关闭，可通过 Queue 动作打开并通过 Close generation queue 关闭；
移动端 390px 视口默认收起 Rail，内容仍保持可见。Player 桌面端采用左侧当前歌曲、中部
transport + progress、右侧音量/队列的音乐播放器层级；移动端收敛为当前歌曲、播放和队列入口。

Library 已巡检 All、Versions、Lyrics、Exports 过滤器，以及版本 Play/Pause、项目和
Studio 链接。Home 与 Project Overview 的候选歌曲均可直接接入 Global Player；Projects、
Project Overview 与 Studio 会读取 provider-neutral 项目/候选 projection，Studio 会按
请求的 `projectRef`/`versionRef` hydration 当前版本。Create Queue 支持活动生成的取消
反馈、无可播放结果时的明确空状态和失败后的 Try again 重试入口；打开时焦点进入 Queue、背景滚动锁定，移动端使用全宽工作表；状态同步优先读取快照并通过 SSE `Last-Event-ID` 回放事件。Studio 已巡检
Arrangement/Lyrics/Stems 切换、Preview、Share 反馈和 Export queued → completed download
action；Arrangement 已提供 Take Lanes，可试听、选择方向并明确 Use take 后切换当前版本；
Lyrics 已提供可编辑草稿、按版本恢复的本地保存和明确的 Saved locally 状态；Stems 已提供 Preview only 的逐轨 Mute/Solo
控制，明确当前仍是音频渲染器接入前的交互层；
Create 的 Smart 模式会先展示可编辑 Song Plan 摘要，用户确认后才持久化 Song Plan 并创建
generation；未实现的 More/Edit 死按钮已移除，避免给用户错误预期。Library 对空的版本投影
提供明确空状态，不再因为过滤器没有对应内容而渲染异常；项目列表从独立的 project projection
合并，避免真实 Library 只返回版本时丢失 Projects 视图；Projects 和 Project Overview 对成功返回的
空 project/candidate projection 也展示明确空状态，不再保留过期的 First Light fixture；Project Overview
对项目和候选 projection 分开收敛，单个投影暂时不可用时也不会把 First Light 候选错挂到实时项目上。
Create 的 Reference 快捷入口会把当前预览资产以 `reference_asset_refs` 写入 generation command，
让界面选择与 API 契约保持一致；真实上传接入仍由后续 storage/music owner adapter 承接。
Custom 模式在选择 Lyrics 时提供可选的用户歌词输入，提交时会按 `lyrics_mode` 和公共契约传递
到 generation command；切换为 Instrumental 后该输入从当前创作界面收起。

Settings 已收敛为 Mori 自身需要的四组能力：Appearance、Playback、Creation、Account；采用
参考 Kokoro Settings 的浮窗结构（固定左侧偏好导航、右侧独立滚动内容、回到来源工作区的关闭入口），
不再把 Kokoro 的 computer、deployment、integration、team、skills、MCP 等通用能力带入
音乐产品；音乐偏好和桌面 Rail 展开状态会保存在当前浏览器中，刷新后仍保持。Create 会在偏好
hydration 完成后同步默认模式、输出类型和时长。全局 Rail 不再放置难以理解的 Current project 卡片，项目入口统一回到 Projects，
具体项目上下文只在 Project Overview 和 Studio 中出现；从任意 Mori 工作区打开 Settings 后，关闭入口会回到来源路径；请求不存在的 Studio 版本时显示明确的 unavailable 状态，不回退到 First Light fixture。
当实时项目没有可播放版本或 Studio 版本失效时，Global Player 保留固定 dock 的空间，但展示
Nothing playing 和下一步提示，播放、跳转、静音等依赖版本的控制会明确禁用。

本轮改动范围仅为 `kokoro-mori`；未修改 BFF、`kokoro-app` 或其他服务仓库。

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
