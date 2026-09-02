# Mori 文档入口

- [Preview acceptance](../ACCEPTANCE.md)
- [全局导航与播放器修订](../../docs/superpowers/specs/2026-09-02-mori-navigation-shell-revision.md)
- [Mori API 契约 v0.1](../../docs/superpowers/specs/2026-09-02-mori-api-contract-v0.1.md)

Mori 是 Kokoro 体系中的独立音乐产品仓库。音乐领域模型、页面组合和品牌视觉留在本仓；
通用浏览器能力通过 `kokoro-web-shared` 的已发布 package 复用。真实 provider 接入必须
经过同源 BFF 和 provider-neutral adapter，不在前端引入供应商私有字段。
