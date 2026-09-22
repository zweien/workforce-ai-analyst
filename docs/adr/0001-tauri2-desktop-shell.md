# ADR-0001: 桌面端采用 Tauri 2 封装

Status: accepted

现有应用是 Vite + React SPA(浏览器版),要做成内部同事"双击安装包即用"的 Windows 优先桌面应用(架构不锁死 macOS/Linux)。选择 Tauri 2(2026-09 时稳定版 2.11.x):对现有前端近乎零改动(仅 `dragDropEnabled: false` 保住 HTML5 拖拽),渲染用 WebView2(Chromium 内核,与开发浏览器表现一致),安装包 2.5-10 MB、空闲内存 40-80 MB,官方插件覆盖文件对话框/FS/自动更新。代价是开发机需一次性安装 Rust 工具链(MSVC + VS Build Tools),业务代码仍全 JS。

## Considered Options

- **Electron 43**:纯 JS 工具链、自带 Chromium 一致性最好,但安装包 100-300 MB、内存 200-400 MB;仅当团队拒绝 Rust 时再选。
- **PWA(Edge 安装)**:零打包零签名,但无 OS 钥匙串(API key 只能进浏览器存储)、安装体验依赖同事会用 Edge,与"双击安装包"的目标不符。保留为退路,前端代码与 Tauri 完全复用。
- **Neutralino 6 / Wails 3 / Electrobun 1**:生态弱 / 需 Go / 单厂商新生态,均不选。

## Consequences

- 更新分发走 tauri-plugin-updater 时需 minisign 密钥管理(一次性单向门);面向国内用户更新源应放国内 OSS 而非 GitHub Releases(二期)。
- Tauri 2.x 内插件 API 偶有破坏性变更,依赖需锁定精确版本。
- WebView2 在极少数锁定版企业镜像中缺失,安装器选用 offline 引导模式兜底。
