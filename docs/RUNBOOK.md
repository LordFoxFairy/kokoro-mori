# Mori 本地运行手册

## 启动

```bash
cd /Users/nako/WebstormProjects/github/thefoxfairy/Kokoro/kokoro-mori
pnpm install --frozen-lockfile
pnpm dev
```

浏览器默认访问 `http://localhost:3000`。Node 版本需满足 `>=22 <23`。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

契约变更还需执行对应 `contract/tests`；引入真实 owner 后再补隔离 integration/smoke，不以 preview fallback 代替。

## 常见故障

- 页面显示 Preview：检查同源 API 是否配置、owner projection 是否可用，再使用页面 Retry；不要把 fixture 当成生产数据。
- 任务卡在恢复：确认 URL 的 `generation_ref`、Project/Version 上下文与浏览器网络，重试应复用原幂等键。
- Save 显示冲突：先 Refresh 获取最新 revision，再重新 Review；不要直接刷新覆盖未保存内容。
- 播放不可用：确认候选存在 opaque `audio_asset_ref` 且媒体 seam 返回可播放响应；无资产时保持 disabled。
- 验证失败：先执行 `git status --short`，只修复本切片文件；不要重置或清理其他仓库/共享服务。
