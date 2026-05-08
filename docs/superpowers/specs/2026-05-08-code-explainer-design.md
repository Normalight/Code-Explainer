# Code Explainer — 代码解释器 Web 应用设计文档

## 背景

个人开发者工具，用于快速理解一个陌生的代码库。上传项目压缩包后，通过 AI 对代码进行智能分段解释，帮助开发者快速掌握项目结构、代码逻辑和文件间的依赖关系。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React + TypeScript |
| 后端 | Spring Boot + Spring AI |
| 数据库 | MySQL（元数据+缓存+对话记录） |
| 向量数据库 | Chroma（代码嵌入 + RAG 检索） |
| 搜索 | Grep（精确代码搜索） + 向量相似度（语义搜索） |
| 存储 | 文件系统（源码） |
| AST | tree-sitter（多语言支持） |
| 通信 | REST API + SSE（AI 流式响应） |
| 图形 | React Flow 或 D3（关系图） |

## 架构

```
React 前端
├── 项目概览页（文件树 + AI 结构分析 + 质量统计 + 进度）
├── 代码解释视图（分栏：解释 | 代码 + 质量评估）
├── AST 分析视图（语法树 | 代码高亮）
├── 关系图视图（文件依赖关系可视化）
├── 项目 AI 对话（全项目上下文对话，RAG 检索）
└── 追问弹窗（选中代码 → 临时对话浮层）
        │
    REST / SSE
        │
Spring Boot 后端
├── 文件服务（上传、解压、文件树）
├── AI 服务（代码解释、追问对话、项目对话）
├── 分析服务（项目结构、AST、依赖关系、质量评估）
├── 搜索服务（向量检索 + Grep 精确搜索）
└── 存储层（MySQL + Chroma + 文件系统）
        │
    Spring AI → 用户配置的 LLM API
```

## 分期计划

### P1：核心链路 + 项目结构分析 + 缓存

目标：上传项目 → 浏览文件 → AI 解释代码，完整可用。

#### 页面 1：项目概览

- 左侧文件树（GitHub 风格），点击文件进入解释视图
- 右侧 AI 生成的项目结构分析：
  - 架构概览（一段文字描述项目类型、架构模式）
  - 语言分布（百分比 + 文件数）
  - 项目统计（文件数、代码行数）
  - **代码总体质量评分**（A/B/C/D 等级 + 分项得分）
  - **问题统计**（按严重程度分类的 issue 数量）
  - **分析进度条**：`已完成 12/20 文件`，分析中的文件名实时显示
- 顶部项目名称 + 上传时间 + 重新上传按钮

#### 页面 2：代码解释视图

- 顶部：面包屑导航（返回箭头 + 文件路径）
- 主体左右分栏：

**左侧 — AI 解释**
- 按逻辑块分段的解释卡片，每个卡片包含：
  - 行号标签（如 `L1-2`）
  - 块标题（如「导入依赖」「路由定义」）
  - 详细描述（可包含行内代码片段）
- 卡片样式：圆角 `border-radius: 6px`，带颜色边框
- 卡片顶部与右侧对应代码组首行严格对齐（JS 动态计算 offsetTop）

**右侧 — 代码**
- 带行号的语法高亮代码
- 同色块标记：解释卡片和对应代码行用相同颜色的左边框 + 背景色
- 颜色方案：蓝色 / 紫色 / 绿色 等，按代码段分配
- Hover 效果：光标悬停代码行 → 背景加深 + 微边框
- 代码组上方插入额外空白，与左侧解释块顶部对齐
- 无解释的行（空行等）不添加额外空白

**文件渲染（根据文件类型自动适配）**

使用成熟的开源库处理不同文件类型的渲染，不自研：

| 文件类型 | 渲染方式 | 库 |
|---------|---------|---|
| 代码文件（.py, .java, .js, .ts, .go, .rs 等） | 语法高亮 + 行号 | react-syntax-highlighter（基于 Prism.js/highlight.js） |
| Markdown（.md, .mdx） | Markdown 渲染 | react-markdown + remark-gfm + rehype-highlight |
| 配置文件（.json, .yaml, .toml, .xml） | 语法高亮 | react-syntax-highlighter |
| 样式文件（.css, .scss, .less） | 语法高亮 | react-syntax-highlighter |
| 图片（.png, .jpg, .svg） | 图片预览 | 原生 `<img>` 标签 |
| 二进制文件 | 不展示内容，显示提示 | — |

- 文件类型检测：根据文件扩展名自动判断，后端通过 MIME type 补充确认
- Markdown 文件特殊处理：渲染为格式化 HTML（支持 GFM 表格、代码块、链接等），同时保留原始 Markdown 切换按钮
- 代码高亮主题：One Dark Pro（与 GitHub Dark 主题匹配）

**选中交互**
- 选中代码行（单行或多行）→ 弹出浮动工具栏
- 工具栏按钮：问 AI / 复制解释 / 复制代码
- 工具栏位于选区上方，带箭头指向选区
- 不设置固定的追问/复制按钮入口

**底部 — 代码质量评估**
- 所有分段解释之后，左侧底部追加一个「质量评估」卡片
- 内容包含：
  - 综合评分（A/B/C/D，对应颜色绿/蓝/黄/红）
  - 分项评估：可读性 / 复杂度 / 规范性 / 安全性，各 1-5 分
  - 问题列表：按严重程度分类
    - 🔴 严重：安全漏洞、明显的逻辑错误
    - 🟡 警告：潜在 bug、不规范写法、性能隐患
    - 🔵 建议：可改进的代码风格、更好的实践
  - 每个问题关联具体的行号范围，点击可跳转高亮

**分析过程中的交互规则**
- 解释生成期间，右侧代码区域完全可用（可滚动、选中、复制）
- 左侧解释区不显示骨架屏，统一显示「正在分析中...」动画
- 阶段 1 返回分段后，左侧变为带行号标签的占位卡片 + 分析中动画
- 阶段 2 逐段流式填充时，完成的卡片变为实际内容
- 用户在分析过程中可以切换查看其他文件（已在缓存中的文件即时展示）

#### 视觉风格

- GitHub Dark 主题（`#0d1117` 背景）
- 扁平化设计，无多余阴影
- SVG 矢量图标（Octicons 风格）
- 程序员审美：代码区用等宽字体，解释区用无衬线字体

#### 后端 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/projects/upload` | POST | 上传 zip，解压，存储 |
| `/api/projects/{id}/tree` | GET | 获取文件树结构 |
| `/api/projects/{id}/structure` | GET | AI 项目结构分析 |
| `/api/projects/{id}/files/{path}` | GET | 获取文件内容 |
| `/api/projects/{id}/files/{path}/explain` | GET (SSE) | AI 代码解释 + 质量评估，流式返回 |
| `/api/projects/{id}/files/{path}/explain/cache` | GET | 获取缓存的解释结果（含质量评估） |
| `/api/projects/{id}/progress` | GET | 分析进度：已完成/总数/分析中文件名 |

#### 缓存策略

- AI 解释结果缓存到 SQLite，key = 文件路径 + 文件内容 hash
- 同一文件未修改时不重复调用 API
- 缓存包含：分段信息（行号范围、标题、描述）、颜色分配、质量评估结果
- 质量评估结果单独缓存，汇总到项目维度用于概览页展示

---

## 核心难点：代码解释的生成

这是整个项目的技术核心。需要解决三个问题：怎么分段、怎么提示、怎么展示生成过程。

### 两阶段生成策略

代码解释不是一次 API 调用完成的，而是分两步：

**阶段 1：结构分析（分段）**
- 输入：代码内容 + 文件路径 + 语言
- 输出：结构化的分段方案（JSON）
- 这是轻量调用，消耗 token 少，速度快

**阶段 2：逐段解释**
- 输入：代码内容 + 阶段 1 的分段结果 + 项目上下文
- 输出：每个分段的详细解释
- 逐段流式返回，前端即时渲染

这样做的好处：
1. 分段逻辑和解释内容解耦，可以单独调试分段质量
2. 前端拿到分段结果后立刻知道有多少解释块，可以先渲染骨架
3. 逐段流式，用户能实时看到解释在生成

### 阶段 1 Prompt：代码分段

```
你是一个代码分析专家。请将以下代码按逻辑块分段。

## 规则
- 按功能逻辑分段，不要逐行分段
- 连续的 import 语句合为一段
- 函数/类的定义 + 函数体合为一段
- 全局变量赋值可以和相邻语句合并
- 空行、纯括号行不单独分段，归属到前后相邻段
- 每段必须覆盖连续的行，不能有遗漏行
- 段与段之间可以有空行间隙（这些行不归属任何段）

## 输出格式
返回 JSON 数组，每个元素：
{
  "startLine": <起始行号，从 1 开始>,
  "endLine": <结束行号>,
  "title": "<简短标题，2-5 个字>",
  "reason": "<一句话说明为什么这样分段>"
}

## 文件信息
- 文件路径：{filePath}
- 语言：{language}
- 总行数：{lineCount}

## 代码内容
```
{code with line numbers}
```
```

**后处理**：
- 校验所有段的 startLine/endLine 合法且连续覆盖（允许空行间隙）
- 如果校验失败，用基于空行 + 缩进的规则作为 fallback 分段
- 分段结果缓存，用于阶段 2 和后续访问

### 阶段 2 Prompt：逐段解释

```
你是一个代码解释助手，正在为开发者解释一个项目中的代码文件。
请用中文解释，技术术语保留英文原文。

## 项目上下文
- 项目类型：{projectStructure}
- 文件路径：{filePath}
- 该文件在项目中的作用：{fileRole}

## 当前代码段
这是文件中第 {startLine}-{endLine} 行，属于「{title}」部分：

```
{segment code}
```

## 解释要求
- 用 1-3 句话解释这段代码做了什么
- 如果涉及关键 API 或设计模式，指出并简要说明
- 如果有潜在的 bug 或不规范的写法，用 ⚠️ 标注
- 回复纯文本，可以包含行内 `code`，不要用 markdown 标题
```

### 阶段 3 Prompt：代码质量评估

分段解释完成后，对整个文件做一次质量评估：

```
你是一个代码审查专家。请对以下文件进行质量评估。

## 文件信息
- 文件路径：{filePath}
- 语言：{language}

## 代码内容
```
{code with line numbers}
```

## 评估维度
1. 可读性（命名、注释、结构清晰度）
2. 复杂度（函数长度、嵌套深度、圈复杂度）
3. 规范性（编码风格、最佳实践遵循情况）
4. 安全性（注入、敏感信息暴露、权限问题）

## 输出 JSON
{
  "grade": "<A|B|C|D>",
  "scores": {
    "readability": <1-5>,
    "complexity": <1-5>,
    "convention": <1-5>,
    "security": <1-5>
  },
  "summary": "<2-3 句话总体评价>",
  "issues": [
    {
      "severity": "<critical|warning|suggestion>",
      "lineStart": <起始行>,
      "lineEnd": <结束行>,
      "title": "<问题标题>",
      "description": "<问题描述和修复建议>"
    }
  ]
}

## 规则
- grade 标准：A=优秀 B=良好 C=一般 D=需改进
- issues 按严重程度排序：critical → warning → suggestion
- 每个维度必须给出 1-5 分，不要都是 5 分或都是 3 分
- issues 不超过 10 个，只列最重要的
```

**项目汇总**：所有文件的质量评估汇总到项目级别：
- 总体评分 = 所有文件分数的加权平均（按代码行数加权）
- 问题统计 = 所有文件 issues 按严重程度分类计数
- 这些数据缓存并用于项目概览页展示

**第 0 秒**：代码区立刻展示（文件内容不需要等 AI），右侧代码正常渲染。左侧解释区统一显示「正在分析中...」动画（旋转图标 + 文字）。

**第 1-2 秒**：阶段 1 返回分段结果。左侧「正在分析中」替换为 N 个占位卡片，每个显示行号标签（如 `L1-2`）+ 脉冲动画。此时用户已经可以正常浏览代码、选中、复制。

**第 2 秒起**：阶段 2 逐段流式返回。每个段从占位变为实际内容：
- 标题从脉冲 → 显示实际标题文字
- 描述区域逐字流式显示（SSE）
- 一段完成 → 下一段开始

**最后**：所有段完成后，追加质量评估卡片（综合评分 + 分项 + 问题列表）。

**用户中途操作**：
- 用户可以在分析过程中切换到其他文件
- 已缓存的文件即时展示，未分析的文件排队
- 切回正在分析的文件时，显示当前已完成的段 + 剩余的占位卡片

**项目概览页的进度**：
- 后端维护一个分析任务队列，上传后自动开始逐文件分析
- `/api/projects/{id}/progress` 返回：`{completed: 12, total: 20, current: "src/utils.py"}`
- 前端轮询该接口（间隔 3 秒），更新进度条和当前分析文件名
- 点击已完成的文件 → 即时展示缓存；点击未分析的文件 → 优先分析并展示

**流式 SSE 数据格式**：
```
event: segment_start
data: {"index": 0, "startLine": 1, "endLine": 2, "title": "导入依赖", "color": "blue"}

event: content
data: {"index": 0, "text": "导入 Flask 框架和"}

event: content
data: {"index": 0, "text": " SQLAlchemy ORM"}

event: segment_end
data: {"index": 0}

event: segment_start
data: {"index": 1, "startLine": 4, "endLine": 5, "title": "应用初始化", "color": "blue"}

...
```

**前端渲染逻辑**：
1. 收到 `segment_start` → 将对应骨架卡片的标题替换为实际标题，开始流式填充描述
2. 收到 `content` → 追加文字到当前段的描述区域
3. 收到 `segment_end` → 当前段完成，下一个骨架卡片准备接收
4. 所有段完成 → 全部骨架消失，完整的解释内容呈现

### 项目结构分析的 Prompt

打开项目概览时也需要一次 AI 调用：

```
你是一个代码架构分析师。请分析以下项目的结构。

## 文件树
{fileTree with line counts and languages}

## 要求
1. 判断项目类型（Web 应用 / CLI 工具 / 库 / 脚本等）
2. 识别架构模式（MVC / 分层 / 单文件等）
3. 列出主要模块及其职责（3-8 个模块）
4. 指出入口文件和核心流程
5. 标注语言分布

## 输出 JSON
{
  "projectType": "<项目类型>",
  "architecture": "<架构模式>",
  "overview": "<3-5 句话的整体描述>",
  "modules": [
    {"path": "<路径>", "role": "<职责>", "description": "<一句话说明>"}
  ],
  "entryPoint": "<入口文件路径>",
  "languageDistribution": [
    {"language": "<语言>", "percentage": <百分比>, "fileCount": <文件数>}
  ]
}
```

### 上下文管理（两种场景独立设计）

系统中有两种 AI 对话场景，上下文管理策略完全不同：

---

#### 场景 1：追问弹窗（无状态，上下文丰富）

临时弹窗，关闭即销毁，无对话历史。但需要自动收集丰富的上下文资料：

**上下文自动收集流程**：

1. **选中代码 + 上下文**：选中行 ± 10 行，约 1000 token
2. **项目结构**：该文件在项目中的 role 和 description（从项目结构分析缓存取），约 200 token
3. **依赖检索**（按需）：
   - 解析选中代码中的 import 语句
   - Grep 搜索被调用函数的定义（`def function_name` / `function function_name`）
   - 每个匹配只取函数签名 + 前 5 行，约 500 token
4. **向量补充**（按需）：如果选中代码较短或信息不足，用 Chroma 检索语义相关的代码片段（Top 3），约 600 token

**Prompt 模板**：

```
你是一个代码解释助手，请回答关于以下代码片段的问题。
用中文回答，技术术语保留英文原文。

## 项目背景
{projectType} · {architecture} — {fileRole}

## 当前文件：{filePath}

## 选中代码（第 {startLine}-{endLine} 行）
```
{selected code with ± 10 lines}
```

## 相关代码（自动检索）
{grep results - function definitions from other files}
{chroma results - semantically related snippets}

## 用户问题
{userQuestion}
```

**Token 控制**：总上下文 ≤ 4000 token，超出时按优先级裁剪（依赖检索 > 向量补充 > 上下文行数缩减）。

---

#### 场景 2：项目级 AI 对话（有状态，滑动窗口 + 摘要压缩）

持久化对话，支持多轮上下文。采用滑动窗口 + 摘要压缩。

**三层上下文结构**：

```
[固定层] 项目背景 + RAG 检索结果          ← 始终保留，每轮重新检索
[滑动窗口层] 最近 8 轮对话完整内容          ← 动态保留
[摘要层] 更早对话的压缩摘要                 ← 窗口外内容压缩
```

**RAG 检索流程**（每轮对话都执行）：
1. 用户问题 → embedding → Chroma 检索 Top 5 语义相关代码片段
2. 同时 Grep 搜索问题中的关键词（精确匹配）
3. 合并去重，取最相关 10 段代码（每段 ≤ 30 行）
4. 检索结果附带来源信息（文件路径 + 行号），用于前端显示引用来源

**滑动窗口策略**：
- 保留最近 8 轮对话（4 问答对）完整内容
- 每轮超过 500 token 的截断到 500 token
- 窗口外的对话压缩为摘要（LLM 后台生成）

**Token 预算分配**（以 128K 上下文为例）：

| 部分 | 预算 | 说明 |
|------|------|------|
| 系统提示 | ~500 token | 角色和规则 |
| 项目背景 | ~300 token | 结构分析 overview |
| RAG 检索结果 | ~3000 token | 10 段相关代码 |
| 对话历史 | ~4000 token | 最近 8 轮 |
| 摘要 | ~500 token | 更早对话压缩 |
| 预留生成 | 剩余全部 | 模型回复空间 |

**Prompt 模板**：

```
你是一个代码分析助手，正在帮开发者理解整个项目。
用中文回答，技术术语保留英文原文。回答时引用具体的文件路径和行号。

## 项目背景
{projectOverview}

## 检索到的相关代码
{RAG results with file paths and line numbers}

## 之前讨论的摘要
{compressedSummary}

## 最近对话
{recent 8 rounds}

## 用户问题
{userQuestion}
```

**上下文生命周期**：
- 对话历史和摘要持久化到 MySQL（`chat_context` + `chat_message`）
- 左侧对话列表可查看历史对话，点击切换
- 新建对话时创建新的 `contextId`

---

### P2：AST 分析 + 代码关系图 + AI 追问

目标：提供深度代码理解能力。

#### 功能 1：AST 语法树分析

- 代码解释视图顶部增加 tab 切换：解释 / AST / 关系图
- AST tab 左右分栏：
  - 左侧：tree-sitter 生成的语法树，带连接线样式
    - 用 `border-left` 垂直连接线连接同级节点
    - `─` 和 `└` 水平连线连接到子节点
    - `▾` 展开/折叠控制
    - 节点用颜色标签区分类型（FunctionDef / Import / Assign 等）
  - 右侧：代码视图
    - 点击 AST 节点 → 对应代码行高亮
    - 高亮样式同 P1 的色块标记

#### 功能 2：代码关系图

- 项目概览页新增「关系图」tab（与「文件」tab 并列）
- 展示文件/模块间的依赖关系：
  - 文件夹作为容器节点（如 `models/` 包含 `user.py` 和 `post.py`）
  - 文件作为叶子节点
  - 实线箭头 = import 依赖，虚线箭头 = 模板渲染等间接依赖
- 使用 React Flow 或 D3 渲染
- 后端通过 AST 分析 import 语句生成关系数据
- 底部图例说明线型和节点类型

#### 功能 3：追问弹窗（临时浮层，无状态）

- 选中代码 → 浮动工具栏 → 点击「问 AI」
- 弹出一个居中的临时对话弹窗（modal），不替换主视图：
  - 顶部：文件路径 + 选中行范围 + 关闭按钮
  - 选中代码上下文展示（代码片段，只读）
  - 对话区域（单次对话，不保留历史）
  - 底部输入框 + 发送按钮
  - **关闭弹窗后对话完全销毁，不持久化**
- 对话通过 SSE 流式返回
- **上下文构建**（无记忆，但需要丰富的上下文资料）：
  - 选中代码 + 前后各 10 行上下文
  - 文件所属模块的项目结构分析（该文件的 role 和 description）
  - 选中代码中涉及的 import 来源文件的函数签名（按需检索）
  - 如果选中的代码调用了其他文件的函数，通过 Grep 搜索函数定义并包含在上下文中
  - 不包含之前的对话历史，每次追问都是独立的新对话

#### 功能 4：项目级 AI 对话（RAG）

- 项目概览页右侧增加「与 AI 对话」区域
- 用户可以问关于整个项目的问题，如：
  - "这个项目的用户认证流程是怎样的？"
  - "Post 模型和 User 模型是什么关系？"
  - "有哪些地方处理了错误？"
- 后端检索策略：**向量检索 + Grep 混合搜索**
  1. 将用户问题转为 embedding，从 Chroma 检索语义相关的代码片段（Top 5）
  2. 同时用 Grep 在项目代码中搜索关键词（精确匹配）
  3. 合并去重后，取最相关的 10 段代码作为上下文
  4. 连同对话历史一起发给 LLM
- 对话历史持久化到 MySQL，关闭后再打开可恢复
- 使用滑动窗口 + 摘要压缩管理上下文（详见下方「上下文管理」章节）

#### 索引构建流程

项目上传后，后台自动构建索引：
1. **Chroma 向量索引**：将每个文件按函数/类分块（chunk），每块生成 embedding 存入 Chroma
   - chunk 策略：函数为最小单位，超长函数按 50 行分割
   - metadata：文件路径、语言、行号范围、类型（function/class/module）
2. **Grep 索引**：文件内容直接存储在文件系统，Grep 实时搜索（用 ripgrep 集成）

#### 后端新增 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/projects/{id}/files/{path}/ast` | GET | 返回 AST 树结构 |
| `/api/projects/{id}/dependencies` | GET | 返回文件依赖关系图数据 |
| `/api/projects/{id}/chat` | POST (SSE) | 项目级 AI 对话（RAG 检索） |
| `/api/projects/{id}/chat/history` | GET | 获取项目对话历史 |
| `/api/projects/{id}/files/{path}/ask` | POST (SSE) | 追问弹窗对话（临时，不持久化） |
| `/api/projects/{id}/index/status` | GET | 向量索引构建进度 |

---

### P3：导出报告 + 搜索 + 体验打磨

#### 功能 1：导出报告

- 项目概览页增加「导出」按钮
- 生成 Markdown 文件，结构：
  ```
  # {项目名} 代码分析报告
  ## 项目概览
  （AI 结构分析内容）
  ## 文件解释
  ### src/main.py
  （代码 + 对应解释）
  ### models/user.py
  ...
  ```
- 前端触发 → 后端生成 → 浏览器下载

#### 功能 2：全局搜索

- 顶部搜索栏，支持搜索文件名和代码内容
- 搜索结果列表：文件路径 + 匹配行 + 上下文（前后各 2 行）
- 点击结果跳转到对应文件的对应行
- 快捷键 `Ctrl+K` 聚焦搜索栏

#### 功能 3：体验打磨

- 拖拽上传 zip 文件（除按钮上传外）
- 大文件虚拟滚动（react-window 或类似方案）
- AI 解释生成中：骨架屏动画（解释卡片位置显示脉冲占位）
- 键盘快捷键：`Esc` 返回上一级

---

## LLM 配置

通过 Spring AI 的配置方式接入用户自己的 API：

```yaml
# application.yml
ai:
  api:
    base-url: <用户配置的 API 地址>
    api-key: <密钥>
    model: <模型名>
```

## 数据模型

### MySQL 表

- `project` — id, name, upload_time, zip_path, overall_grade, total_issues_critical, total_issues_warning, total_issues_suggestion
- `file` — id, project_id, path, content_hash, language, line_count, analysis_status(pending/analyzing/done), indexed(tinyint)
- `explanation` — id, file_id, segment_json, created_at
- `quality_assessment` — id, file_id, grade, scores_json, summary, issues_json, created_at
- `chat_context` — id, project_id, summary, created_at, updated_at
- `chat_message` — id, context_id, role, content, sources_json, created_at

### Chroma 向量集合

- `code_chunks` — 每个文件的函数/类级代码块
  - document: 代码文本
  - embedding: 向量
  - metadata: {project_id, file_path, language, start_line, end_line, type(function/class/module)}

### 文件系统

- `uploads/{project_id}/` — 解压后的源码文件
