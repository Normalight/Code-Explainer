const zhCN = {
  // App
  appTitle: 'Code Explainer',
  appDesc: 'AI 驱动的代码理解工具',

  // Upload
  dropHere: '拖拽 .zip 文件到此处或点击上传',
  maxSize: '最大 500MB',
  uploading: '上传中',
  processing: '正在处理项目...',
  processingSub: '正在解压文件并构建索引',
  cancel: '取消',
  uploadFailed: '上传失败',
  pleaseZip: '请上传 .zip 文件',
  orImportGithub: '或从 GitHub 导入',
  githubPlaceholder: 'https://github.com/user/repo',
  importBtn: '导入',
  importing: '导入中...',

  // Sidebar
  files: '文件',
  backToProjects: '返回项目列表',
  search: '搜索',
  collapseSidebar: '拖拽调整大小，双击折叠侧栏',
  expandSidebar: '展开侧栏',

  // Tabs
  overview: '概览',
  dependencies: '依赖关系',
  commits: '提交记录',
  aiChat: 'AI 对话',

  // Overview
  analysisProgress: '分析进度',
  sourceFiles: '个源码文件',
  nonCodeSkipped: '个非代码文件已跳过',
  exportReport: '导出报告',
  projectStructure: '项目结构分析',
  techStack: '技术栈',
  entryPoints: '入口文件',
  modules: '模块',
  unknown: '未知',
  selectFile: '从侧边栏选择文件查看分析',
  noDepData: '暂无依赖关系数据',

  // Commits
  noCommits: '暂无提交记录',
  selectCommit: '选择一个提交查看变更',
  aiReview: 'AI 审查',
  reviewing: '审查中...',
  committed: '提交于',
  justNow: '刚刚',

  // Chat
  newChat: '+ 新对话',
  noConversations: '暂无对话记录',
  askProject: '向此项目提问...',
  askAnything: '可以向这个项目提任何问题',
  send: '发送',
  thinking: '思考中...',

  // Code view
  explain: '解释',
  ast: 'AST',
  analyzing: '分析中...',
  analyzingSeg: '正在分析...',
  noAst: '未找到 AST 节点',
  qualityAssessment: '质量评估',
  issues: '问题',
  askAI: '问 AI',
  copy: '复制',
  filePreview: '文件预览',
  source: '源码',
  preview: '预览',

  // File tree
  analysisDone: '分析完成',
  analysisAnalyzing: '分析中',
  analysisPending: '待分析',

  // Recent projects
  recentProjects: '最近项目',

  // Settings
  settings: '设置',
  language: '语言',
  theme: '主题',
  dark: '深色',
  light: '浅色',
  about: '关于',
  aboutDesc: 'Code Explainer 是一个 AI 驱动的代码理解工具，帮助你快速了解陌生代码库。',
  aboutVersion: '版本',
  aboutTech: '技术栈',
  aboutTechList: 'React + TypeScript / Spring Boot + Spring AI / MySQL + ChromaDB',
  aboutAuthor: '作者',
  aboutLicense: '开源协议',
  close: '关闭',
  failedLoadDiff: '加载 diff 失败',
  reviewFailed: '审查失败',
  failedResponse: '获取回复失败',
  startAnalysis: '分析代码',

  // Quality overview
  qualityOverview: '质量概览',
  analyzedFiles: '个文件已分析',
  averageScores: '平均分数',
  topIssues: '主要问题',
  noQualityData: '暂无质量评估数据',
} as const;

export type TranslationKey = keyof typeof zhCN;

export default zhCN;
