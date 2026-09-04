# Mori 当前状态

> 更新：2026-09-04
> 范围：本地 preview 产品壳、Create、Library、Project、Studio 与 Finish 工作面。

## 已实现

- 浅色、整高 Rail + 内容面 + 全局 Player 三层壳体；桌面展开 Rail 不使用悬浮窗口。
- 移动端 Rail 默认收起；展开后为带遮罩的导航抽屉，锁定背景滚动、焦点进入并循环在 Rail 内，内容面与 Player 使用 `inert` 隔离，关闭后恢复触发入口。
- 全局 Player 的 `Up next` 在桌面作为上下文面板，在移动端作为 modal sheet；支持 Escape、焦点恢复和移动端焦点循环。
- Create → Generation Queue → Candidate → Project / Version → Studio → Take Lanes → Current Version 的本地闭环。
- Studio Arrangement / Lyrics / Stems / Finish 工作面，以及 Add part、Replace section、Extend、Transform（Restyle / Cover）的一层 AI 意图模型。
- Studio Change 在 Review Plan 后才生成；请求 builder 统一 snake_case、范围、保护项、references 和输出数量，并保持当前 Version 非破坏式。
- Mori API 与公共 Web package 保持本仓边界；未修改 Root、BFF 或 sibling service。
- 全局 Player 继续保持 viewport-fixed 的底部 transport；shell 通过同一组 `--mori-player-height` /
  `--mori-player-safe-space` token 预留可滚动安全区，短桌面视口将 dock 收敛到 72px，避免 Studio 的
  AI Changes / Take Lanes 被底部控件过度遮挡，移动端继续保留安全区与底部 sheet 行为。
- 全局 Player 已接入窄化的 same-origin media seam：Candidate 只携带 opaque `audio_asset_ref`，浏览器通过
  `/api/v1/mori/assets/{asset_ref}/content` 获取音频；Provider 使用可注入的 media controller 同步真实
  `play/pause/seek/mute/timeupdate/ended` 状态，不再用定时器伪造播放。preview Candidate 没有音频资产时显示
  `Preview audio is unavailable` 并禁用播放，真实媒体加载失败会停止 Playing、保留错误上下文并提供 Retry playback。
- Library 已接入 provider-neutral 的 live projection seam：Version 使用 `GET /library`，Creative Source
  使用独立的 `GET /library/sources` 与按 kind/ref 的 deep-link GET；两者各自使用 opaque cursor/limit，
  Audio / Voice / Inspiration 使用 discriminated union。Source API 成功后不再把 preview Sources 混入 live 响应；
  未配置 API 或所有 projection 都不可用时保留 preview fallback，单个 Source projection 失败则清空该区域并明确显示 unavailable，
  避免把过期 fixture 当成真实数据；Library 会消费 `next_cursor` 提供 Load more / Try again，Create deep link 会优先解析 live Source detail。

## 验证证据

在本仓执行：

```text
pnpm lint                         passed
pnpm typecheck                    passed
pnpm test --maxWorkers=1          passed: 45 files / 353 tests
pnpm build                        passed
```

## 已知边界

- 当前页面仍保留 preview fallback；真实 provider 适配、持久化 Project/Version/Source 和公开 Product API
  由后续 owner contract 驱动，不在组件内伪造。Library 的浏览器契约已先固定投影形状，供后续同源 owner 接入。
- `mori-workspace.module.css` 与部分历史组件仍有较大的聚合文件，后续按 shell、Studio surface、responsive responsibility 拆分，避免一次性重写导致视觉回归。
- 新能力必须先补 component / request-builder / contract test，再接入真实同源 API；不要把 `reference`、`voice` 或 `provider` 私有字段扩散到 UI。
