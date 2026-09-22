# ADR-0002: LLM 调用从 Gemini 迁移到国内 OpenAI 兼容 API

Status: accepted

应用源自 Google AI Studio,原用 `@google/genai` 调 Gemini。但实际用户在国内企业内网:既难直接访问 Google API,也几乎无法申请 Gemini key。决定改为调用任意 OpenAI 兼容的 chat completions 端点(DeepSeek / Qwen / GLM / Kimi 等),服务地址、模型名、API key 均为运行时用户配置(管理员统一申请 key 经内部渠道分发,首次启动粘贴),key 存 Windows 凭据管理器,绝不打进安装包。

## Consequences

- 移除 `@google/genai` 依赖,`geminiService` 改写为通用 LLM 客户端;系统提示词与聚合数据结构不变。
- 网络可达性问题的应用内代理配置项取消:国内 LLM 端点直连,无需代理(WebView2 本就自动走系统代理,兜底已覆盖)。
- key 由管理员内部分发:同事理论上可从自己机器的凭据管理器导出,可信内团队范围内接受。
- 数据出境(发往 Google)的合规顾虑随之消失;发往国内 LLM 的数据仍默认脱敏(高负荷名单姓名 → "员工A/B…",设置页可关)。
