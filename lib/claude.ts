// ===== Claude API 集成模块 =====
// 合同审查的核心AI逻辑
// 支持 DeepSeek（通过 Anthropic 兼容端点）和 Anthropic Claude

import { AIRiskAnalysis, AIReviewResult, RiskType, RiskLevel, ChatMessage } from './types';

const apiKey = process.env.ANTHROPIC_API_KEY;
const baseURL = process.env.ANTHROPIC_BASE_URL;
// 模型名称：默认为 Claude Sonnet，可通过环境变量切换为 DeepSeek 等兼容模型
const modelName = process.env.AI_MODEL_NAME || 'claude-3-5-sonnet-20241022';

export function isClaudeConfigured(): boolean {
  return !!apiKey;
}

// 通过原生 fetch 调用 AI API（兼容 DeepSeek 和 Anthropic）
async function callAIAPI(
  prompt: string,
  maxTokens: number = 4000,
): Promise<string> {
  const apiBase = baseURL || 'https://api.anthropic.com';
  const url = `${apiBase}/v1/messages`;

  console.log(`[AI] 调用 API: ${url}, model: ${modelName}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[AI] API 返回错误 ${response.status}:`, errText.substring(0, 300));
    throw new Error(`AI API 错误 (${response.status}): ${errText.substring(0, 200)}`);
  }

  const data = await response.json();

  // 提取文本内容
  const text = (data.content || [])
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('');

  console.log('[AI] API 响应成功，文本长度:', text.length);
  return text;
}

// 风险识别的Prompt模板
const RISK_ANALYSIS_PROMPT = `你是一名企业法务审查专家。请分析以下合同文本，识别对甲方（我方）风险最大的条款。

对每项风险，严格按以下JSON格式输出：
{
  "clause_id": "条款编号（如'第12.3条'，没有编号则用'段落N'）",
  "clause_text": "条款原文（逐字引用合同中的文字，不可改写或概括）",
  "risk_type": "风险类型（从以下选择：payment_risk, delivery_risk, breach_liability, intellectual_property, confidentiality, dispute_resolution, force_majeure, termination, indemnification, data_protection, non_compete, governing_law, other）",
  "risk_level": "风险等级（high/medium/low）",
  "risk_explanation": "一句话解释为什么有风险",
  "is_standard_clause": "是否为市场标准条款（true/false）",
  "suggested_redline": "建议修改后的条款文本"
}

规则：
1. 仅引用合同中真实存在的条款，不要编造
2. clause_text必须与合同原文逐字匹配
3. 如果某方面合同保持沉默（如未约定违约金），请明确指出
4. risk_level判定标准：
   - high: 可能导致重大经济损失、法律纠纷或合同无效
   - medium: 偏离市场惯例、增加我方义务但不至于重大损失
   - low: 措辞不严谨但不影响实质权利义务
5. suggested_redline应给出具体的修改后条款文本，而非笼统建议

同时输出合同整体信息：
- contract_type: 合同类型
- contract_title: 合同标题
- summary: 一段话总结合同整体风险状况
- overall_risk_score: 综合风险评分（0-100，越高风险越大）

最终输出格式（严格JSON，不要其他文字）：
{
  "contract_type": "采购合同",
  "contract_title": "XX采购合同",
  "summary": "整体风险评述...",
  "overall_risk_score": 65,
  "risks": [ ... ]
}`;

// 执行合同审查
export async function reviewContract(contractText: string): Promise<AIReviewResult> {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // 如果合同太长，截断
  const truncatedText = contractText.length > 150000
    ? contractText.substring(0, 150000) + '\n[合同内容过长，已截断]'
    : contractText;

  const responseText = await callAIAPI(
    `${RISK_ANALYSIS_PROMPT}\n\n合同文本：\n${truncatedText}`,
    4000
  );

  // 解析JSON响应
  let result: AIReviewResult;
  try {
    // 提取JSON部分（AI可能输出额外文字）
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    result = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse AI response: ' + responseText.substring(0, 500));
  }

  // 验证引用：检查每个clause_text是否在原始合同中存在
  result.risks = result.risks.map(risk => ({
    ...risk,
    citation_verified: verifyCitation(risk.clause_text, contractText),
  }));

  return result;
}

// 引用验证：检查AI引用的条款文本是否在原始合同中真实存在
function verifyCitation(clauseText: string, contractText: string): boolean {
  if (!clauseText || clauseText.length < 10) return false;

  // 清理文本（去除多余空白）
  const cleanClause = clauseText.replace(/\s+/g, ' ').trim();
  const cleanContract = contractText.replace(/\s+/g, ' ');

  // 精确匹配
  if (cleanContract.includes(cleanClause)) return true;

  // 模糊匹配（Levenshtein距离 < 10%）
  const tolerance = Math.floor(cleanClause.length * 0.1);
  const substring = cleanContract.substring(
    cleanContract.indexOf(cleanClause.substring(0, 20)),
    cleanContract.indexOf(cleanClause.substring(0, 20)) + cleanClause.length + tolerance
  );

  if (substring && levenshteinDistance(cleanClause, substring) <= tolerance) {
    return true;
  }

  return false;
}

// Levenshtein距离计算（用于引用验证）
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

// 生成修改建议（Redline）
export async function generateRedline(
  clauseText: string,
  riskType: string,
  riskExplanation: string
): Promise<string> {
  if (!apiKey) {
    return '（需要配置 AI API密钥才能生成修改建议）';
  }

  const responseText = await callAIAPI(
    `请修改以下合同条款，消除其中的风险。

原条款：${clauseText}
风险类型：${riskType}
风险说明：${riskExplanation}

请直接给出修改后的条款文本，不要解释修改原因。修改应：
1. 消除对我方不利的条款
2. 使条款更符合市场惯例
3. 保持法律效力和可执行性
4. 修改幅度尽可能小，只改必要的部分`,
    2000
  );

  return responseText.trim();
}

// ===== 合同问答助手 =====

// 问答结果的引用类型
export interface QAReference {
  clause_id: string;
  clause_text: string;
}

// 问答结果
export interface QAResult {
  answer: string;
  references: QAReference[];
}

// 合同问答Prompt模板
const QA_PROMPT = `你是一名企业法务专家助手。请根据以下合同文本回答用户的问题。

要求：
1. 回答必须基于合同原文，不要编造合同中不存在的内容
2. 在回答中引用相关的条款编号和原文片段
3. 如果合同中对相关问题保持沉默（未约定），请明确指出这一点
4. 回答用中文，条理清晰，适合非法律专业人士理解
5. 同时给出简要的实务建议

合同文本：
{CONTRACT_TEXT}

请严格按以下JSON格式输出（不要输出其他任何文字）：
{
  "answer": "回答正文（可包含条款引用）",
  "references": [
    {
      "clause_id": "条款编号（如'第3.2条'，没有则用'段落N'）",
      "clause_text": "条款原文（逐字引用合同中的文字，不可改写）"
    }
  ]
}`;

// 执行合同问答
export async function askContractQuestion(
  contractText: string,
  question: string,
  history?: ChatMessage[]
): Promise<QAResult> {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // 截断超长合同文本
  const truncatedText = contractText.length > 150000
    ? contractText.substring(0, 150000) + '\n[合同内容过长，已截断]'
    : contractText;

  // 构建包含合同文本和当前问题的提示
  const prompt = `${QA_PROMPT.replace('{CONTRACT_TEXT}', truncatedText)}

用户问题：${question}`;

  const responseText = await callAIAPI(prompt, 4000);

  // 解析JSON响应
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const result = JSON.parse(jsonMatch[0]) as QAResult;
    return {
      answer: result.answer || responseText,
      references: result.references || [],
    };
  } catch {
    // JSON解析失败，返回纯文本回答
    return {
      answer: responseText.trim(),
      references: [],
    };
  }
}
