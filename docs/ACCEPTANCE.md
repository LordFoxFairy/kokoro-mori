# Mori 验收基线

## 核心路径

1. 从 Create 形成 Smart/Custom Song Plan，确认后进入 Generation Queue。
2. 在 Project 中识别 Preview 与 live projection，恢复 Open Version 与工作上下文。
3. 在 Studio 选择 Arrangement/Lyrics/Stems/Finish；AI 操作先 Review，再 Generate。
4. 在 Take Lanes 试听、比较候选，明确 `Use take` 后才更新 Current Version。
5. 在 Finish 保存 Mix/Export/Artwork/Release Draft；Publish 仅在草稿确认后开放。

## 体验门禁

- 桌面 Rail 展开/收起不使用悬浮主导航；移动端使用抽屉、遮罩、焦点循环与背景 inert。
- Player 始终是 viewport-fixed 底部 transport，页面内容预留安全区，不遮挡 Studio 操作。
- loading、empty、error、unavailable、disabled、reconnecting、success 均有明确文案与可操作出口。
- 选择、试听、保存、生成、取消、恢复和冲突不会把旧 Version 的响应挂到当前上下文。
- Settings 保持 Kokoro 浮动窗口信息架构，不卸载当前工作面。

## 当前证据

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

实际通过数量以当前 commit 的命令输出为准；Playwright、真实 owner integration、provider 与发布 smoke 在尚未配置时列为未运行，不以文字宣称通过。
