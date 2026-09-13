# Mori 技术方案

> 状态：当前浏览器方案，2026-09-12。本文不把 preview 实现写成 durable owner。

## 1. Owner 与范围

Mori (`kokoro-mori`) 负责 AI 音乐产品的 Web 工作区、浏览器交互状态、同源 adapter、provider-neutral request builder 与恢复 guard。它不拥有 Project、Version、Generation、Asset、Release 或 Identity 的持久化事实，也不直连数据库、对象存储或第三方 provider。

固定方向为：

```text
Browser -> Mori same-origin adapter -> BFF/owner contract
```

跨仓只消费版本化契约；不 import 别仓业务 DTO、ORM 类型或 provider SDK。

## 2. 产品工作流

```text
Create -> Generation Queue -> Candidate -> Project/Version -> Studio -> Take Lanes -> Current Version -> Finish/Release
```

- Create：一句话 Smart 与可控 Custom，均先形成可编辑 Song Plan。
- Project：保存当前 Song Plan、Open Version、Lyrics Draft 与工作上下文摘要。
- Studio：Arrangement、Lyrics、Stems、Finish；AI 操作都绑定当前 Version 与明确范围。
- Take Lanes：比较候选，明确提交 Current；试听不等于提交。
- Finish/Release：Mix、Export、Artwork、Release Draft 与 Publish 由独立契约承接。

## 3. 当前模块

- `mori-app-shell`：桌面固定 Rail、内容面、移动抽屉与 viewport-fixed Player。
- `mori-workspace`：跨页面路由、Project/Create/Library/Settings 组合与投影恢复。
- `studio-page`：Version 上下文、Studio Change、Lyrics、Stems、Export、Release 与 Composition 交互编排。
- `StudioAiComposer`：Arrangement 上下文 AI command bar；compact 模式将一级意图、Scope、输入与 Review 放在时间线前，
  高级 Reference / Cover / Preserve 控制仍复用同一状态与请求模型并收进可展开层。
- `composition*.ts`：纯 Composition 规则、revision command、history 和 save state。
- `generation*.ts`：队列摘要、SSE replay、取消、重试和刷新恢复。
- `creative-assets.ts` 与 source 组件：Creative Source 类型、preview fallback 与选择器。

复杂度增长时按能力拆分；不创建 `common/` 垃圾桶，不为简单 UI 逻辑机械创建 service/repository/domain 层。

## 4. 状态与失败恢复

所有异步工作显式区分 `idle / loading / queued / streaming / saving / succeeded / failed / cancelled / expired / unavailable` 等状态。生成、歌词修订、Stem separation、Export 与 Artwork 使用：

1. 发起时保存完整 command 上下文与幂等键；
2. 使用 snapshot 与可 replay event 恢复；
3. AbortSignal 贯穿 fetch/reader；
4. 通过 project/version/generation epoch 丢弃迟到响应；
5. 瞬时故障保留原 command，重试复用原幂等身份；
6. 冲突显示 Refresh/Review，不静默覆盖用户当前版本。

Composition 当前以 `Composition { tracks[] }` 作为浏览器侧 revision foundation：每条编辑 command 都携带 `track_ref`，Studio 通过同源 GET 加载 owner projection，Move、Trim、Split、Crop、Fade、Insert、Duplicate 可形成本地 history 并通过同源 PUT 保存；`clip_ref` 在当前 wire model 中承担 timeline placement identity，新建 placement 使用唯一 opaque ref，编辑和 command replay 保持该身份；Arrangement session 在 Studio 工具切换时保持 mounted，未保存命令在切换工具、Version 或离开 Project 前进入显式保护层，Discard 回到最近一次 owner-confirmed composition，Save 继续复用原 revision 与幂等键；空/不可用投影时才保留一条明确的 Main track fallback，真实 BFF owner persistence、独立 Placement projection 与 recovery smoke 仍未接入。

## 5. 依赖规则

- 页面只依赖 feature 公开组件与 `MoriApi` 窄接口。
- 组件不解析 provider 私有字段，不拼接对象存储 URL，不自报 tenant/actor。
- `contract/` 只维护 wire schema；生成/验证事实不复制到业务组件。
- Preview data 只能作为明确标记的 unavailable fallback，不冒充用户数据。
- Studio 打开已有 Version 时可以向全局 transport 预置暂停的当前 Version；该动作不自动播放、不写入 playback queue，
  且只在 transport 尚无显式用户选择时发生，不能覆盖正在试听的 Version。

## 6. 目标演进顺序

1. Suno 核心闭环：Durable Project Memory、source ingest、Studio editing、Finish/Share/Publish。
2. Studio 专业能力：Asset Dock、真实多轨 Composition、Take Lanes、Stem/Mix/Export。
3. Mori 差异化：Project memory、可解释 AI plan、跨步骤恢复、模板与协作。

真实 owner 接入前，先完成 owner contract、integration/contract evidence，再替换 preview seam；不在 Mori 内建设第二套事实源。
