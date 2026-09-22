// OpenAI-compatible chat-completions client (ADR-0002).
// Works with any domestic provider exposing the OpenAI format:
// DeepSeek, Qwen (DashScope compatible-mode), GLM, Kimi, etc.
import { AttendanceRecord } from "../types";
import { getApiKey, getSettings, isTauri } from "./settings";

const SYSTEM_INSTRUCTION = `你是一位顶级人力资源数据分析专家和组织绩效顾问。
你的任务是根据提供的考勤数据，生成一份极具洞察力的中文 Markdown 格式分析报告。

报告结构应包含以下内容：
1. **核心观察 (Executive Summary)**：用一两句话总结当前团队的最显著特征。
2. **多维度工时分析**：
   - **部门效能**：哪些部门是工时高地？哪些部门处于极低水平？
   - **岗位画像**：不同职位（Position）之间的工时差异分析。识别出最辛苦的岗位类别。
   - **时间趋势**：如果存在多个批次/月份，分析工时是处于上升还是下降趋势，是否存在周期性波动。
3. **风险预警 (Risk Assessment)**：
   - 识别过度劳累（Burnout）高危群体（如：持续平均工时 > 10小时的岗位或部门）。
   - 关注工时过低的异常点，分析是否存在业务量不足或记录不准确的风险。
4. **针对性管理建议**：
   - 给出至少3条具体的、可落地的改进建议。建议应区分对待不同性质的职位（如行政 vs 技术 vs 生产）。

要求：数据驱动、洞察敏锐、措辞专业且具备建设性。`;

export class LlmConfigError extends Error {}

/**
 * Normalizes user-provided base URL to a full chat-completions endpoint.
 * Accepts any of:
 *   https://api.deepseek.com            -> + /v1/chat/completions
 *   https://api.deepseek.com/v1         -> + /chat/completions
 *   https://.../v1/chat/completions     -> as-is
 * A missing scheme defaults to http:// for LAN hosts (IP / localhost / *.local)
 * and https:// everywhere else.
 */
export const toChatCompletionsUrl = (raw: string): string => {
  let trimmed = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    const isLan = /^(localhost|\d{1,3}(\.\d{1,3}){3}([:/]|$)|[a-z0-9-]+\.local\b)/i.test(trimmed);
    trimmed = `${isLan ? 'http' : 'https'}://${trimmed}`;
  }
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
};

/** 脱敏: replace employee names with 员工A/B/... keeping dept/position (ADR-0002). */
const anonymizeName = (name: string, index: number): string =>
  `员工${String.fromCharCode(65 + (index % 26))}`;

const buildSummaryData = (
  records: AttendanceRecord[],
  departmentContext: string | null,
  positionContext: string | null,
  anonymize: boolean
) => {
  const totalEmployees = records.length;
  const totalHours = records.reduce((sum, r) => sum + r.workDuration, 0);
  const avgDuration = totalEmployees > 0 ? totalHours / totalEmployees : 0;

  const deptStats = records.reduce((acc, curr) => {
    const dept = curr.department || '未知部门';
    if (!acc[dept]) acc[dept] = { count: 0, total: 0, max: 0 };
    acc[dept].count++;
    acc[dept].total += curr.workDuration;
    acc[dept].max = Math.max(acc[dept].max, curr.workDuration);
    return acc;
  }, {} as Record<string, any>);

  const deptSummary = Object.entries(deptStats).map(([name, stats]) => ({
    部门: name,
    平均工时: (stats.total / stats.count).toFixed(2),
    样本量: stats.count,
    最高峰值: stats.max.toFixed(1)
  }));

  const posStats = records.reduce((acc, curr) => {
    const pos = curr.position || '未知职位';
    if (!acc[pos]) acc[pos] = { count: 0, total: 0 };
    acc[pos].count++;
    acc[pos].total += curr.workDuration;
    return acc;
  }, {} as Record<string, any>);

  const posSummary = Object.entries(posStats).map(([name, stats]) => ({
    职位: name,
    岗位均值: (stats.total / stats.count).toFixed(2),
    占比: ((stats.count / totalEmployees) * 100).toFixed(1) + '%'
  })).sort((a, b) => parseFloat(b.岗位均值) - parseFloat(a.岗位均值)).slice(0, 8);

  const batchStats = records.reduce((acc, curr) => {
    const batch = curr.date || '未知';
    if (!acc[batch]) acc[batch] = { total: 0, count: 0 };
    acc[batch].total += curr.workDuration;
    acc[batch].count++;
    return acc;
  }, {} as Record<string, any>);

  const sortedBatches = Object.keys(batchStats).sort();
  const trendSummary = sortedBatches.map(batch => {
    const stats = batchStats[batch];
    return {
      批次: batch,
      均值: (stats.total / stats.count).toFixed(2),
      记录: stats.count
    };
  });

  // 高负荷名单: the only person-level data sent out; anonymized by default.
  const top5 = [...records]
    .sort((a, b) => b.workDuration - a.workDuration)
    .slice(0, 5)
    .map((r, i) => {
      const name = anonymize ? anonymizeName(r.name, i) : r.name;
      return `${name} (${r.department}/${r.position}) - ${r.workDuration.toFixed(2)}h [${r.date}]`;
    });

  return {
    上下文信息: {
      筛选部门: departmentContext || "所有部门",
      筛选职位: positionContext || "所有职位",
      覆盖周期: sortedBatches.join(' 到 '),
      包含月份数: sortedBatches.length
    },
    核心指标: {
      总处理记录数: totalEmployees,
      全样本平均工时: avgDuration.toFixed(2),
      基准线: "8.0小时"
    },
    趋势快照: trendSummary,
    重点岗位排行: posSummary,
    部门对比数据: deptSummary,
    高负荷Top5名单: top5
  };
};

export const generateAttendanceReport = async (
  records: AttendanceRecord[],
  departmentContext: string | null,
  positionContext: string | null
): Promise<string> => {
  const settings = getSettings();
  const url = toChatCompletionsUrl(settings.baseUrl);

  if (!settings.baseUrl.trim() || !settings.model.trim()) {
    throw new LlmConfigError("尚未配置 LLM 服务地址、模型或 API Key,请先打开设置完成配置。");
  }

  const summaryData = buildSummaryData(records, departmentContext, positionContext, settings.anonymize);

  const prompt = `
    作为 AI 顾问，请基于以下汇总的考勤行为数据进行深度审计和分析。

    数据摘要:
    \`\`\`json
    ${JSON.stringify(summaryData, null, 2)}
    \`\`\`

    请输出专业、深度的 Markdown 报告。注意：如果数据跨越多个月份，请重点提及趋势变化。
  `;

  // In the Tauri app the call runs on the Rust side: no CORS /
  // Local-Network-Access restrictions, and the key never enters the webview.
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('llm_chat', {
        url,
        model: settings.model,
        system: SYSTEM_INSTRUCTION,
        prompt,
      });
    } catch (err) {
      throw new Error(typeof err === 'string' ? err : (err as Error)?.message ?? String(err));
    }
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new LlmConfigError("尚未配置 API Key,请先打开设置完成配置。");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
      }),
    });
  } catch (err) {
    throw new Error("无法连接 LLM 服务,请检查网络或服务地址是否正确。");
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message ?? JSON.stringify(body).slice(0, 200);
    } catch { detail = await response.text().catch(() => ''); }
    throw new Error(`LLM 服务返回错误 ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  const content = message?.content?.trim() ? message.content : message?.reasoning_content;
  return content || "AI 暂时无法生成报告，请检查网络或稍后再试。";
};
