# WorkForce AI Analyst

考勤工时智能分析工具:上传考勤 Excel,本地生成统计与可视化,可选用任意 OpenAI 兼容 LLM 服务生成分析报告。支持浏览器运行与 Windows 桌面端(Tauri 2)。

## 桌面端(推荐)

### 开发环境要求

- Node.js ≥ 20
- Rust 工具链(rustup,MSVC host)
- Visual Studio 2022 Build Tools(含 "使用 C++ 的桌面开发" 工作负载)
- Windows 10 1809+(自带 WebView2 运行时)

### 常用命令

```bash
npm install

# 浏览器开发(无 Tauri 壳,Key 存 localStorage)
npm run dev

# 桌面应用开发(启动 Tauri 窗口,热重载)
npm run tauri:dev

# 构建 Windows 安装包(NSIS,输出于 src-tauri/target/release/bundle/nsis/)
npm run tauri:build
```

### AI 服务配置

首次使用点击右上角 ⚙ 设置,填入:

- **服务地址**:任意 OpenAI 兼容服务(DeepSeek / 通义千问 / 智谱 / Kimi 等),如 `https://api.deepseek.com/v1`
- **模型名称**:如 `deepseek-chat`
- **API Key**:存入 Windows 凭据管理器,不写入任何文件
- **数据脱敏**(默认开):发送给 AI 的"高负荷名单"中员工姓名替换为"员工A/B…",部门与职位保留

本地统计(概览、图表、汇总、Excel 导出)完全不依赖 AI,未配置时照常可用。

## 安装包分发说明(内部)

安装包未做代码签名,同事首次运行若触发 SmartScreen 蓝色提示:

1. 点击"更多信息"
2. 点击"仍要运行"

安装器内置 WebView2 离线引导,无 Edge/WebView2 的机器也能完成安装。

## 架构文档

- `CONTEXT.md` — 领域术语表
- `docs/adr/0001-tauri2-desktop-shell.md` — 桌面框架选型(Tauri 2 vs Electron vs PWA)
- `docs/adr/0002-openai-compatible-llm.md` — LLM 从 Gemini 迁移到国内 OpenAI 兼容 API
- `docs/agents/` — 工程协作约定(issue 跟踪 / triage 标签 / 领域文档消费规则)
