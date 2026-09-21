import { GoogleGenAI } from "@google/genai";
import { AttendanceRecord } from "../types";

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

export const generateAttendanceReport = async (
  records: AttendanceRecord[], 
  departmentContext: string | null,
  positionContext: string | null
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1. Basic stats
  const totalEmployees = records.length;
  const totalHours = records.reduce((sum, r) => sum + r.workDuration, 0);
  const avgDuration = totalEmployees > 0 ? totalHours / totalEmployees : 0;
  
  // 2. Department aggregation
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

  // 3. Position aggregation
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

  // 4. Time/Batch trend
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

  // 5. Build Final Summary Data for AI
  const summaryData = {
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
    高负荷Top5名单: [...records]
      .sort((a, b) => b.workDuration - a.workDuration)
      .slice(0, 5)
      .map(r => `${r.name} (${r.department}/${r.position}) - ${r.workDuration.toFixed(2)}h [${r.date}]`)
  };

  const prompt = `
    作为 AI 顾问，请基于以下汇总的考勤行为数据进行深度审计和分析。
    
    数据摘要:
    \`\`\`json
    ${JSON.stringify(summaryData, null, 2)}
    \`\`\`
    
    请输出专业、深度的 Markdown 报告。注意：如果数据跨越多个月份，请重点提及趋势变化。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1, // Lower temperature for more analytical consistency
      }
    });
    
    return response.text || "AI 暂时无法生成报告，请检查网络或稍后再试。";
  } catch (error) {
    console.error("Gemini context analysis failed:", error);
    throw error;
  }
};