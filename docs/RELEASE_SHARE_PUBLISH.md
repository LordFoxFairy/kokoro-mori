# Release、Share、Publish 设计

> 状态：P0.3 浏览器契约设计阶段（2026-09-05）

## 产品判断

参考 Suno 的连续创作路径，Mori 将“编辑深链”“可分享链接”和“公开发布”拆成三个不同对象：

```text
Version / Mix
  → Release Draft（可编辑、默认 Private）
  → Share（link_only，可撤销）
  → Release（public，发布后稳定身份）
```

用户在 Studio 完成歌曲后，先保存 Release Draft；只有保存确认成功，才显示 Publish。Copy link 在 draft 阶段只复制
编辑上下文，发布后才复制公开 Release URL，避免把私有编辑链接误称为分享链接。

## Owner 与边界

| 事实 | Owner | Mori 负责 |
|---|---|---|
| Release draft | BFF / Product owner | 表单、revision、保存确认 |
| Share permission / token | BFF / IAM owner | 可见性与撤销状态呈现 |
| Published Release | BFF / Storage owner | Publish review、结果与 Library 投影 |
| 音频 / artwork bytes | Storage owner | 只消费 opaque refs |

Mori 不生成公开 URL、不保存 share token、不直接改权限表，也不把 `public` 草稿状态冒充已发布。

## 状态机

```text
draft → publishing → published
  │          └→ failed → retry
  └→ archived
published → unpublished
```

- `draft`：只存在于当前 Version 的 Release Draft。
- `publishing`：后台校验 Version、Mix、Artwork、权限并创建公开 Release。
- `published`：返回稳定 `release_ref` 与公开链接；重复 Publish 必须 replay 同一结果。
- `unpublished`：公开链接失效，但历史 Release 身份保留，后续重新发布不覆盖旧事实。

## 浏览器私有 API

### Publish

`POST /api/v1/mori/versions/{version_ref}/release`

```json
{
  "release_draft_ref": "opaque-release-draft-ref",
  "expected_draft_revision": 3
}
```

请求必须带 `Idempotency-Key`。响应返回 `release_ref`、`version_ref`、`status`、`public_url`（published 时非空）和
`created_at`。服务端必须验证 draft 仍属于该 Version，且来源 Mix / Artwork projection 没有失效。

### 读取与撤销

- `GET /api/v1/mori/releases/{release_ref}`：Library 与深链读取公开投影。
- `POST /api/v1/mori/releases/{release_ref}/unpublish`：带 `Idempotency-Key`，只撤销公开可见性，不删除 Version 或 Draft。

错误使用稳定 `code / message / retryable`；Mori 只根据 `retryable` 决定是否保留 Publish command，不暴露权限或 Storage 内部细节。

## 交互门禁

1. Draft 保存未得到完整 revision 确认前，Publish 按钮不存在或 disabled。
2. Publish 前展示来源 Version、Mix、Artwork、Visibility、Remix permission 和最终标题。
3. `publishing` 可关闭窗口后恢复；重试复用原始 draft revision 与幂等键，不重复创建 Release。
4. Publish 成功后，Studio 与 Library 显示独立的 Release 状态和 Copy public link。
5. 编辑深链始终使用 `Copy edit link`；公开链接始终使用 `Copy public link`，两者不复用字段。
6. Unpublish 后保留本地编辑上下文与 Release history，但公开链接显示已撤销。

## 暂不开放

- Feed、评论、榜单、关注、外部分发、多人协作发布。
- 将“公开草稿”直接映射为已发布资源。

## 放行条件

- OpenAPI、TypeScript parser/client 与 Release UI 的状态机一致。
- 覆盖 publish retry 幂等、draft revision 冲突、unpublish 重放、刷新恢复和 Library projection。
- 真实 owner integration smoke 证明公开 URL、权限和撤销结果。
