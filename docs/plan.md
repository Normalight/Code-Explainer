# Code Explainer — 持续开发计划

> 每次新增任务先更新此文档，用 XML 标签标记状态。同一文档持续使用，防止遗漏和目标漂移。

---

## 约束

- **i18n 必做**：所有用户可见字符串用 `t()` 调用，补充 zh-CN/en-US 翻译键
- **优先用成熟库**：能用成熟库就不要自己重新实现（npm 包等）
- **先写计划**：实施前更新此文档，标明范围
- **完成后提交 git**：完成功能/修改后自动 git commit

---

## 已完成

<done>
### 代码/AST 仅对代码文件启用
- `CodeViewPage.tsx`: 添加 `isCodeFile()`/`isImageFile()`/`isMarkdownFile()` 判断
- 非代码文件不显示 Explain/AST tab，图片显示预览，其他显示纯文本
</done>

<done>
### 解释块流式输出
- 修复 SSE content 事件 segment index 追踪 bug
- 用 `activeSegmentRef` 替代 `Object.keys(prev).length`，`segment_end` 时 +1
- 每个 segment 的解释实时流式追加显示
</done>

<done>
### 概览模块点击定位到 sidebar
- `ProjectPage.tsx`: 新增 `focusPath` 状态和 `handleLocateInTree` 回调
- `StructureDisplay` 的 `onLocateInTree` 替代 `onFileClick`
- `FileTree.tsx`: 接收 `focusPath` prop，自动展开父目录、滚动定位、高亮
</done>

<done>
### Markdown 文件左侧预览右侧源码
- `.md` 文件在 `CodeViewPanel` 中左右分栏：左 Markdown 渲染预览，右源码
- 其他非代码文件单栏显示
</done>

<done>
### Modules 层级路径显示
- `StructureDisplay` 中 modules 的 `mod.path` 按 `/` 分段显示
- 父级半透明小字 + `/` 分隔，末级高亮
</done>

<done>
### Sidebar 排序
- 后端 `FileService.buildTree()` 添加 `sortTree()` 递归排序
- 规则：文件夹优先，文件名按字母不区分大小写排序
</done>

<done>
### 结构分析缓存
- `Project` 实体新增 `structureAnalysis` TEXT 字段
- `ExplanationController.structure()` 命中缓存直接返回（11ms vs 数秒）
</done>

<done>
### timeAgo 函数
- `ProjectPage.tsx`: 添加 `timeAgo()` 函数修复 commits 面板运行时错误
- 支持 i18n：`t('justNow')` / `t('committed')`
</done>

<done>
### 代码滚动修复
- `CodeViewPanel` 右侧代码区 `overflow: hidden` → `overflow: auto`
- `VirtualCodeView` 小文件模式外包可滚动 div
</done>

<done>
### 解释块与代码对齐
- 左侧解释卡片根据代码行号计算 `marginTop`，与右侧代码段顶部对齐
- `LINE_HEIGHT = 20.8`，`CODE_TOP_PAD = 16`
</done>

<done>
### 完整 i18n
- 所有硬编码字符串替换为 `t()` 调用
- 新增翻译键：committed, justNow, source, preview, techStack, entryPoints, modules, unknown, failedLoadDiff, reviewFailed, failedResponse 等
</done>

<done>
### 构建修复
- 修复 zh-CN.ts 导出方式（`export default` → 命名导出 + 默认导出）
- 清理未使用变量/导入（App.tsx, DependencyGraphFlow, SearchModal, FileTree, ChatContent）
- `npm run build` 通过
</done>

---

## 待做

<todo>
### 后端重启后 Hibernate schema 自动更新验证
- 确认 `structure_analysis` 列已被自动添加到 projects 表
- 如果 `ddl-auto: update` 未生效需要手动 ALTER TABLE
</todo>

<done>
### 导入后 sidebar 默认折叠
- `ProjectPage.tsx`: `loadProject` 中设置 `setSidebarCollapsed(true)`
- 上传/GitHub 导入后进入项目页自动折叠
</done>

<done>
### 解释块与代码对齐 + 同步滚动
- CodeViewPanel header 改为全宽（`flexDirection: column`），左右两侧 scroll 起点一致
- 左右面板按 scroll ratio 同步滚动，用 `syncingScroll` ref 防止循环触发
- Markdown 预览/源码也按百分比同步滚动
</done>

<done>
### 解释块与代码同步滚动
- 已合并到上方「对齐+同步滚动」任务中完成
</done>

<todo>
### Redis 缓存（未开始）
- 后端引入 Spring Data Redis
- 缓存热点：文件内容、解释结果、结构分析
- 当前只有 MySQL 缓存（ExplanationCache）和结构分析字段缓存
</todo>

<todo>
### 大文件虚拟滚动性能
- `VirtualCodeView` 的虚拟滚动阈值 300 行
- 超大文件（>5000行）可能需要进一步优化
- 考虑用成熟库（如 react-virtuoso）替代手写虚拟滚动
</todo>

<todo>
### 按块分析数据前端缓存
- 后端已有按段缓存（ExplanationCache），前端每次打开文件仍重新走 SSE
- 前端可以对已完成的文件直接一次性加载缓存，不走 SSE 流
- 或者后端 `/explain` 已有缓存命中回放逻辑，验证是否正常工作
</todo>

<todo>
### 前端测试
- 关键组件添加单元测试（FileTree, StructureDisplay, CodeViewPanel）
- API 层 mock 测试
</todo>

<todo>
### P2 功能：AST 视图优化
- 当前 AST 是平铺列表，应改为树形结构
- 需要后端返回嵌套的 AST 结构而非扁平节点列表
</todo>

<todo>
### P2 功能：依赖关系图优化
- 文件夹作为容器节点，文件作为叶子节点
- 实线 = import，虚线 = 间接依赖
- 底部图例
</todo>

<todo>
### P2 功能：追问弹窗
- 选中代码 → 工具栏「问 AI」→ 居中 modal 弹出
- 弹窗内：选中代码上下文 + 对话 + 输入框
- 关闭即销毁，无状态
</todo>

<todo>
### P2 功能：项目级 AI 对话（RAG）
- Chroma 向量检索 Top 5 + Grep 精确搜索
- 滑动窗口 8 轮 + 摘要压缩
- SSE 流式返回，附带引用来源
</todo>

<todo>
### P3 功能：全局搜索
- `Ctrl+K` 触发搜索栏
- 搜索代码内容和文件名
- 结果列表点击跳转
</todo>

<todo>
### P3 功能：导出报告
- 概览页「导出」按钮 → 下载 Markdown 报告
- 包含结构分析 + 所有文件解释
</todo>
