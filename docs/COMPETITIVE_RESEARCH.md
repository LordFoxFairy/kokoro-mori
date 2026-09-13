# Mori 竞品与供应商研究

> 调研日期：2026-09-13。本文把“观察到的产品事实”与“Mori 的产品决策”分开，避免把竞品页面或
> 供应商实现细节直接当成我们的领域模型。

## 1. 结论先行

- **Suno 适合作为工作流骨架参考**：Create、Project、Version、Studio、Take Lanes、Transport、Library
  构成连续制作上下文，AI 生成不是一次性结果页。
- **Tad 适合作为能力命名参考**：Smart / Custom 与 Generate / Reference / Remix / Edit 让用户先按意图
  选择任务；Cover、Vocal Remover、Stem Splitter、MV、TTS 的能力边界也较容易理解。
- **Mori 不照搬两者的页面树**：全局导航只保留 Home、Create、Projects、Library；生成后的能力必须带着
  当前 Project + Version 进入 Studio，结果统一进入 Take Lanes，用户确认后才改变 Current Version。
- **供应商接入继续保持 provider-neutral**：浏览器只使用 Mori 同源契约；Suno、Tad 或其他模型的字段、
  token、credits、任务状态与媒体地址留在 BFF / provider adapter 边界。

## 2. 已核实的产品事实

### Suno

官方 [Studio 2.0](https://help.suno.com/en/articles/13670529) 当前把 AI 生成与完整制作环境放在一起：

- Chat Bar 承接生成音频、MIDI、插件与项目操作；Transport 位于时间线上方。
- Studio Library 位于右侧 dock，支持搜索、快速试听、拖入时间线或 Chat Bar，并按项目记忆筛选与搜索视图；底部仍有 dock 内 mini-player。
- 自然语言入口仍绑定当前作品上下文，而不是把 AI 协作拆成另一个聊天产品。
- 每次生成的 alternatives 进入 Take Lanes，再由用户试听并提交到时间线。
- Studio 已继续扩展到 automation、effects、MIDI、synth、recording 与 advanced stems。
- 导出覆盖整首、选区、多轨，以及 32-bit WAV / MP3 和独立 stems。
- Create 的模型选择器已经包含私有 Custom Model：至少六首拥有权明确的歌曲可以建立私有模型；它应作为 Creative Identity 生命周期建模，而不是普通 Style preset。

这说明 Suno 的关键优势不是“功能更多”，而是 **所有功能都围绕同一个作品与时间线上下文连续发生**。

官方 [Suno Platform](https://platform.suno.com/) 已明确提供 REST API，公开登录页写明可从 prompt 生成
original songs、covers 与 mashups；API account 与详细文档需要使用关联 Suno 账号的 Google 登录后查看。
因此当前能确认“官方 API 存在”，但在完成账号内文档核验前，不预设 endpoint、鉴权、限流或任务生命周期。

### Tad

登录后的 [AI Music Generator](https://tad.ai/ai-music-generator) 当前呈现两层任务选择：

```text
表达深度：Smart | Custom
任务意图：Generate | Reference | Remix | Edit
```

Edit 会进一步明确 Replace Section、音频输入与 Lyrics；结果区 My Library 再按 ALL、AI Music、AI Cover、
AI MV、Vocal Remover、Text to Speech 分类。官方公开页面还列出 Audio Editor、Vocal Remover 与 Stem Splitter。

Tad 的优势是 **用户先知道自己要做哪一种 AI 操作**；弱点是能力数量继续增长后容易形成工具集合，作品、版本、
试听与继续制作之间的连续性不如 Project-first 模型自然。

Tad 公开页也把 AI prompt assistance 作为降低起步成本的能力：先给带有 genre、instrument、BPM、style、mood
的可选方向，再允许用户继续修改。Mori 吸收“提供创意起点”，但不自动跳过 Review 或直接触发生成。

截至调研日期，在 Tad 官方站点导航和公开站点检索中未发现 developer portal 或公开 API documentation 入口。
这只是“当前未发现公开入口”，不推断其内部接口或后续计划。

## 3. Mori 的吸收方式

### 3.1 用 Suno 的对象连续性做骨架

```text
Idea / Source
  -> Song Plan
  -> Generation
  -> Candidates
  -> Version
  -> Studio Change
  -> Take Lanes
  -> Current Version
  -> Mix / Export / Release draft
```

任何页面都应回答三个问题：我正在处理哪个 Project、打开哪个 Version、下一次操作的结果去哪里。

### 3.2 用 Tad 的任务语言降低理解成本

Tad 的标签不直接变成全局页面，而是映射到正确上下文：

| Tad 意图 | Mori 入口 | 原因 |
|---|---|---|
| Generate | Create | 从无到有，先形成 Song Plan |
| Reference | Create · Creative sources | 是新作品的输入，不是独立产物 |
| Remix / Edit | Studio · Arrangement | 必须绑定当前 Version 和范围 |
| Cover | Studio · Transform | 是整首音频变换，不是 Release artwork |
| Vocal Remover / Stem Splitter | Studio · Voice & stems | 输出应继续参与试听、混音和导出 |
| AI MV | Studio · Finish / Release | 是歌曲完成后的后置产物 |
| TTS | 暂不设全局入口 | 只有形成 spoken vocal / guide voice 的音乐 Job 时再进入 |

### 3.3 Mori 的 AI 交互统一语法

所有生成与修改能力复用同一套可解释结构：

```text
Source       当前 Project / Version / Mix Revision
Scope        整首、段落、时间范围或插入点
Intent       Generate / Add / Replace / Extend / Transform / Finish
Instruction  用户自然语言要求
Constraints  必须保留的旋律、歌词、声音、速度或结构
Output       alternatives 数量与格式
Destination  Song Plan、Take Lanes、Mix Revision 或 Release draft
Commit       用户显式确认后才改变持久化事实
```

自然语言负责表达创意，结构化字段负责保护不可模糊的事实。AI 不能直接覆盖 Current Version，也不能把失败或
尚未确认的本地状态伪装成成功。

Studio 的自然语言输入按 Add part、Replace section、Extend、Restyle、Vocal Cover、Instrumental Cover
提供少量上下文 starter。点击只会预填并聚焦仍可编辑的输入框；用户仍需 Review Change Plan，starter 本身不成为
新的任务类型、全局入口或自动执行命令。

## 4. 下一轮界面方案

### A. Project Overview 提供上下文 AI 动作（推荐）

Project Overview 不再只放一个笼统的 `Open Studio`。在确认的 Current Version 下展示一个克制的
`Continue making` 区域：

```text
Remix & edit     -> Arrangement / Transform
Cover            -> Arrangement / Transform / Cover
Write lyrics     -> Lyrics
Voice & stems    -> Stems
Finish song      -> Finish
```

每个动作只解释“会做什么”和“结果去哪里”，点击后带着同一个 Project + Current Version 深链到 Studio 的正确
工作面。`Open Studio` 仍可作为次级通用入口；`New direction` 继续从当前 Project 进入 Create。

其中 `Remix & edit` 与 `Cover` 必须拆成两个入口：前者对应对段落或整首的非破坏式改编，后者对应基于当前
Version 的全曲新演绎。两者都进入同一个 Arrangement 工作面，但分别预选 Transform / Restyle 与 Transform / Cover，
避免用“Restyle or cover”把两个不同的用户意图重新混在一起。

推荐深链语义：

```text
/studio/{version_ref}?surface=arrangement&intent=transform
/studio/{version_ref}?surface=arrangement&intent=cover
/studio/{version_ref}?surface=lyrics
/studio/{version_ref}?surface=stems
/studio/{version_ref}?surface=finish
```

查询参数必须通过白名单解析；缺少 Current Version 时不猜测候选，改为引导用户先生成或选择版本。

### B. 在 Create 复制 Tad 的 Generate / Reference / Remix / Edit 页签

优点是能力立即可见；缺点是 Remix / Edit 必须先选择已有作品，会把“创建新作品”和“修改当前作品”混在一个
对象上下文里，用户还要重复找歌。只保留 Generate / Reference 的思路，不采用完整复制。

### C. 增加全局 AI Tools 页面

短期展示能力最容易，长期会变成 Cover、Remover、Stem、MV、TTS 的入口堆叠，并绕开 Project / Version。
不采用。

## 5. 方案 A 的交互验收

- 页面只读取服务端确认的 `current_version_ref`，不默认取第一个 Candidate。
- 四个动作都保留 Project / Version 上下文，并打开唯一、正确的 Studio surface。
- 浏览器返回后仍回到同一 Project；切换 Version 后不复用旧深链状态。
- 桌面端使用一行或 2×2 克制动作区；窄屏单列，不新增 Rail 图标或悬浮侧窗。
- Studio 仍只有一个全局 Transport；切换工作面不停止当前试听。
- 动作名称稳定、解释短，参数与高级控制只在进入对应工作面后渐进展开。

## 6. Suno API 接入前的账号内核验清单

登录 Suno Platform 后，需要逐项记录并冻结来源日期：

1. 鉴权方式、密钥作用域与服务端存储要求。
2. generation / cover / mashup 的 endpoint、请求与响应 schema。
3. 异步任务状态机、polling / webhook、取消、重试与幂等支持。
4. model catalog、输入长度、音频格式、文件大小与输出数量限制。
5. credits、rate limit、并发限制与可编程错误码。
6. 媒体 URL 生命周期、下载方式、数据保留与删除语义。
7. 商业权利、上传内容责任、生成内容使用范围与训练数据选项。

核验完成后只实现 provider adapter mapping，不修改 Mori 的 Project、Version、Generation、Candidate 与
Take Lanes 领域语义。
