# Creative Source Ingest 设计

> 状态：浏览器契约设计阶段（2026-09-05）  
> Owner：`kokoro-mori` 负责页面状态与同源 API 映射；真实 Asset / Upload 事实由 Storage owner 保存。

## 目标

把 Suno 式的“上传参考素材后继续创作”变成 Project 内可恢复、可复用的连续流程。Create 不再把本地
`File` 直接伪装成 `asset_ref`，也不把音频字节写入 localStorage。浏览器只持有 opaque 的
`upload_ref`、`asset_ref` 与 `source_ref`。

## 责任与放置

| 项目 | 结论 |
|---|---|
| Owner | Storage owner：文件字节、扫描、生命周期；Mori：Create / Library 展示与请求编排 |
| Mori 目录 | 复用 `src/lib/mori-api.ts`、`src/lib/mori-api-client.ts` 与现有 `creative-assets.ts`；不新增 provider adapter |
| 淘汰方案 | 不放入 `mori-workspace.tsx` 内拼接上传协议；不新增全局 Upload 页面；不修改 BFF 或 Root |
| 数据事实 | Mori 只消费上传会话投影与 ready Source；不保存文件内容、bucket、object key 或 signed URL |
| 验证 | request-builder / response-parser / contract / component / Playwright smoke；真实字节上传由 Storage integration smoke 验证 |

## 状态机

```text
idle → creating → uploading → processing → ready
                  │             ├→ failed → retry
                  ├→ cancelled
                  └→ failed → retry
```

- `creating`：已创建 Upload Session，但还没有开始传输。
- `uploading`：显示已传输字节；取消只取消当前会话，不删除已有 Source。
- `processing`：Storage 正在做格式、大小、恶意内容与音频可读性检查。
- `ready`：返回可用于 `reference_asset_refs[]` 的 `asset_ref`，并创建可在 Library 复用的 `source_ref`。
- `failed`：保留用户选择和错误上下文；Retry 创建新的传输尝试，但沿用用户当前选择，不重复创建 Generation。
- 刷新或切换 Project 后，仅凭 `upload_ref` 恢复状态；终态以 owner projection 为准。

## 浏览器私有契约

### 1. 创建会话

`POST /api/v1/mori/creative-source-uploads`

```json
{
  "source_kind": "audio",
  "file_name": "reference.wav",
  "content_type": "audio/wav",
  "byte_size": 2400000,
  "project_ref": "opaque-project-ref"
}
```

响应返回 `upload_ref`、`status`、`expires_at` 与允许的上传方式；不返回 provider 私有字段。

### 2. 上传字节与查询

- `PUT /api/v1/mori/creative-source-uploads/{upload_ref}/content`：同源二进制上传，支持 `Content-Length` 与取消。
- `GET /api/v1/mori/creative-source-uploads/{upload_ref}`：恢复状态、进度、错误码、`asset_ref` / `source_ref`。
- `POST /api/v1/mori/creative-source-uploads/{upload_ref}/cancel`：带 `Idempotency-Key`，可重复调用。

状态响应最小形状：

```json
{
  "upload_ref": "opaque-upload-ref",
  "source_kind": "audio",
  "status": "processing",
  "bytes_received": 2400000,
  "byte_size": 2400000,
  "asset_ref": null,
  "source_ref": null,
  "error": null,
  "created_at": "2026-09-05T00:00:00Z",
  "updated_at": "2026-09-05T00:00:04Z",
  "expires_at": "2026-09-06T00:00:00Z"
}
```

`ready` 时 `asset_ref` 与 `source_ref` 必须同时非空；除 `ready` 外二者必须为 `null`。错误只使用稳定
`code` / `message` / `retryable`，不向浏览器暴露 Storage 或 provider 原始信息。

## Create 交互规则

1. 选择文件后先校验扩展名、MIME、大小，再创建 Upload Session；未进入 `ready` 前 Generate disabled。
2. 上传状态位于 Creative Sources 卡内，不弹出阻断式全局窗口；用户可以继续编辑 prompt、style 与 lyrics。
3. `ready` 才写入 `reference_asset_refs[]`；取消、失败或过期会清除该引用并保留 Retry。
4. Generation command 只接收 ready 的 opaque `asset_ref`；上传重试与生成重试是两套幂等边界。
5. Library 只展示 ready Source；Source deep link 进入 Create 后先读取 owner detail，再恢复选择状态。

## 暂不开放

- 批量上传、浏览器录音、波形裁剪、分片断点续传。
- 在 Mori 内实现 Storage、病毒扫描、音频转码或 provider upload URL。
- 将 `File`、`Blob` 或音频字节放入 Project Workspace、Generation Queue 或 URL。

## 放行条件

- 机器契约与 TypeScript parser 对齐，ready / failed / cancelled / expired 均有测试。
- Playwright 覆盖选择文件 → uploading → processing → ready → Generate，以及失败 Retry 和刷新恢复。
- Storage integration smoke 证明有效文件成功率、重复 cancel、过期会话和重试幂等。
- `MUSIC_CAPABILITIES.md` 与 `SUNO_PARITY.md` 只在上述浏览器门禁通过后把 P0.2 标成完成；当前仍为设计阶段。
