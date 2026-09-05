# Mori 文档入口

- [Preview acceptance](../ACCEPTANCE.md)
- [全局导航与播放器修订](../../docs/superpowers/specs/2026-09-02-mori-navigation-shell-revision.md)
- [Mori API 契约 v0.1](../../docs/superpowers/specs/2026-09-02-mori-api-contract-v0.1.md)
- [Mori 代码地图](./CODEBASE_MAP.md)
- [Mori 当前状态](./CURRENT.md)
- [Mori × Suno 能力对齐基线](./SUNO_PARITY.md)
- [Mori Studio Change OpenAPI](../contract/openapi/mori-studio-change.v1.json)
- [Mori Library Sources OpenAPI](../contract/openapi/mori-library-sources.v1.json)
- [Creative Source Ingest OpenAPI](../contract/openapi/mori-creative-source-ingest.v1.json)
- [Mori 音乐能力模型](./MUSIC_CAPABILITIES.md)
- [Creative Source Ingest 设计](./CREATIVE_SOURCE_INGEST.md)
- [Mori 产品形态基线](./PRODUCT_SHAPE.md)
- [Suno / Tad 竞品与供应商研究](./COMPETITIVE_RESEARCH.md)

Mori 是 Kokoro 体系中的独立音乐产品仓库。音乐领域模型、页面组合和品牌视觉留在本仓；
通用浏览器能力通过 `kokoro-web-shared` 的已发布 package 复用。当前 preview 已覆盖
Create → Queue → Candidate → Library → Studio → Global Player 的本地交互闭环；真实
provider 接入必须经过同源 BFF 和 provider-neutral adapter，不在前端引入供应商私有字段。
