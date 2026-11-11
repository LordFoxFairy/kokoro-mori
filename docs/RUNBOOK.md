# Mori 本地运行手册

## 启动

```bash
cd /Users/nako/WebstormProjects/github/thefoxfairy/Kokoro/apps/kokoro-mori
pnpm install --frozen-lockfile
pnpm dev
```

浏览器默认访问 `http://localhost:3000`。Node 版本需满足 `>=22 <23`。

## 正式会话与配置

- 用户先在 Product 建立原生会话，再从同源 Mori 入口使用已有会话；独立 Next 开发页不等于独立登录，冷登录流程未做。
- 服务端显式配置 `KOKORO_BFF_BASE_URL`、`KOKORO_INTERNAL_SECRET_WEB_BFF`、`KOKORO_WEB_ORIGIN`；
  secret 不进浏览器、命令回显或仓库。缺任何配置即 fail closed，不再从 loopback 推断 fixture、namespace 或 principal。
- 测试 peer 与 fixture 必须由测试显式注入配置，独占端口并回收自己的进程；不重启正常业务服务或共享依赖。
- 普通 body 为 1 MiB／读取 5 秒，普通请求含响应体 30 秒；只有 creative-source content PUT 为 50 MiB／读取 120 秒，
  随后 JSON 回执阶段 30 秒。媒体／SSE 首部 30 秒、等待上游读取的空闲 60 秒，流内取消应停止上游并释放读取资源。
- 超时写入仍可能已被 owner 接收，重试沿用原 command／幂等键，不据超时生成第二次操作。
- 当前 BFF 未映射 Mori 上传／媒体 owner，50 MiB 只是 adapter 传输能力；preview、真实媒体链与持久化验收保持区分。


## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

契约变更还需执行对应 `contract/tests`；引入真实 owner 后再补隔离 integration/smoke，不以 preview fallback 代替。

## 常见故障

- 页面显示 Preview：检查显式三配置与 owner projection 是否可用，再使用页面 Retry；不要把 fixture 当成生产数据。
- 401／配置不可用：先确认 Product 已有原生会话及三配置，不恢复旧 cookie／namespace／principal，也不新增 Mori 登录。
- 上传或媒体 unavailable：先区分 adapter 资源限制与缺少 BFF owner 映射；不能把本地 fixture 响应写成真实上传／播放成功。
- 任务卡在恢复：确认 URL 的 `generation_ref`、Project/Version 上下文与浏览器网络，重试应复用原幂等键。
- Save 显示冲突：先 Refresh 获取最新 revision，再重新 Review；不要直接刷新覆盖未保存内容。
- 播放不可用：确认候选存在 opaque `audio_asset_ref` 且媒体 seam 返回可播放响应；无资产时保持 disabled。
- 验证失败：先执行 `git status --short`，只修复本切片文件；不要重置或清理其他仓库/共享服务。
