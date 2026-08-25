// ===== AI合同问答 API 路由 =====
// 接收合同ID和问题，返回基于合同内容的智能回答及相关条款引用

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { isClaudeConfigured, askContractQuestion } from '@/lib/claude';
import { isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_REVIEW_RESULT, getMockContracts, getMockRisks } from '@/lib/mock-data';
import { ChatMessage, ContractRisk, RISK_LEVEL_CONFIG, RISK_TYPE_LABELS } from '@/lib/types';

// 问题关键词到风险类型的映射
const QUESTION_KEYWORD_MAP: { keywords: string[]; risk_type: string; label: string }[] = [
  { keywords: ['付款', '支付', '预付', '货款', '价款', '结算', '金额'], risk_type: 'payment_risk', label: '付款条件' },
  { keywords: ['交付', '验收', '发货', '交货', '运输', '到货'], risk_type: 'delivery_risk', label: '交付条款' },
  { keywords: ['违约', '违约金', '赔偿', '损失', '责任'], risk_type: 'breach_liability', label: '违约责任' },
  { keywords: ['知识产权', '专利', '商标', '著作权', '成果归属', '权属'], risk_type: 'intellectual_property', label: '知识产权' },
  { keywords: ['保密', '机密', '商业秘密', '保密期'], risk_type: 'confidentiality', label: '保密义务' },
  { keywords: ['争议', '仲裁', '诉讼', '管辖', '纠纷'], risk_type: 'dispute_resolution', label: '争议解决' },
  { keywords: ['不可抗力'], risk_type: 'force_majeure', label: '不可抗力' },
  { keywords: ['终止', '解除', '期满', '续签', '到期'], risk_type: 'termination', label: '合同终止' },
  { keywords: ['赔偿', 'indemnif', '补偿'], risk_type: 'indemnification', label: '赔偿责任' },
  { keywords: ['数据', '隐私', '个人信息', '信息安全'], risk_type: 'data_protection', label: '数据保护' },
  { keywords: ['竞业'], risk_type: 'non_compete', label: '竞业限制' },
  { keywords: ['适用法律', '管辖法律', '法律适用'], risk_type: 'governing_law', label: '管辖法律' },
];

// 从Mock风险数据构建合同文本（用于演示模式）
function buildContractTextFromRisks(risks: ContractRisk[]): string {
  return risks.map(r => `${r.clause_id} ${r.clause_text}`).join('\n\n');
}

// 演示模式：基于关键词匹配生成智能回答
function generateDemoAnswer(
  question: string,
  risks: ContractRisk[]
): { answer: string; references: { clause_id: string; clause_text: string }[] } {
  // 匹配问题关键词
  const matchedTypes = new Set<string>();
  const matchedLabels: string[] = [];

  for (const mapping of QUESTION_KEYWORD_MAP) {
    if (mapping.keywords.some(kw => question.includes(kw))) {
      matchedTypes.add(mapping.risk_type);
      matchedLabels.push(mapping.label);
    }
  }

  // 根据匹配结果筛选相关风险条款
  let relevantRisks: ContractRisk[];
  if (matchedTypes.size > 0) {
    relevantRisks = risks.filter(r => matchedTypes.has(r.risk_type));
    // 若关键词命中但该类型风险不在列表中，回退到全部风险
    if (relevantRisks.length === 0) {
      relevantRisks = risks;
    }
  } else {
    // 未匹配到特定关键词，返回整体风险评估
    relevantRisks = risks;
  }

  // 构建引用
  const references = relevantRisks.map(r => ({
    clause_id: r.clause_id,
    clause_text: r.clause_text,
  }));

  // 构建回答正文
  let answer = '';

  if (matchedLabels.length > 0) {
    const uniqueLabels = Array.from(new Set(matchedLabels));
    answer += `针对您询问的「${uniqueLabels.join('、')}」相关问题，基于合同条款分析如下：\n\n`;
  } else {
    answer += `根据本合同的整体审查情况，为您梳理如下：\n\n`;
  }

  // 逐条说明相关风险
  relevantRisks.forEach((risk, idx) => {
    const levelConfig = RISK_LEVEL_CONFIG[risk.risk_level];
    const typeLabel = RISK_TYPE_LABELS[risk.risk_type];
    answer += `${idx + 1}. ${risk.clause_id}（${typeLabel}·${levelConfig.label}）\n`;
    answer += `   条款内容：${risk.clause_text}\n`;
    answer += `   风险提示：${risk.risk_explanation}\n`;
    if (risk.suggested_redline) {
      answer += `   修改建议：${risk.suggested_redline}\n`;
    }
    answer += '\n';
  });

  // 整体建议
  const highRisks = risks.filter(r => r.risk_level === 'high');
  if (highRisks.length > 0) {
    answer += `【整体建议】本合同存在${highRisks.length}项高风险条款（${highRisks.map(r => r.clause_id).join('、')}），建议在签署前重点修改上述条款，以保障我方权益。`;
  } else if (relevantRisks.length > 0) {
    answer += `【整体建议】相关条款风险总体可控，但建议关注上述条款的措辞严谨性，必要时进行微调。`;
  } else {
    answer += `【整体建议】该合同在所询问的方面未发现明显风险条款。如需了解其他方面，请继续提问。`;
  }

  return { answer, references };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contract_id, question, history } = body as {
      contract_id: string;
      question: string;
      history?: ChatMessage[];
    };

    // 参数校验
    if (!contract_id) {
      return NextResponse.json({ error: '缺少合同ID（contract_id）' }, { status: 400 });
    }
    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: '缺少问题内容（question）' }, { status: 400 });
    }

    // ===== 获取合同文本和风险列表 =====
    let contractText = '';
    let risks: ContractRisk[] = [];
    let contractTitle = '';

    if (isSupabaseConfigured()) {
      // 实际模式：从Supabase查询合同文本和风险
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          const { data: contractData } = await supabase
            .from('contracts')
            .select('contract_text, contract_title')
            .eq('id', contract_id)
            .single();
          if (contractData) {
            contractText = contractData.contract_text || '';
            contractTitle = contractData.contract_title || '';
          }

          const { data: riskData } = await supabase
            .from('contract_risks')
            .select('*')
            .eq('contract_id', contract_id);
          risks = (riskData as ContractRisk[]) || [];
        }
      } catch (dbErr) {
        console.error('DB query failed:', dbErr);
      }
    }

    // 若数据库未取到数据，回退到Mock数据
    if (!contractText && risks.length === 0) {
      const mockContracts = getMockContracts();
      const mockContract = mockContracts.find(c => c.id === contract_id);
      contractTitle = mockContract?.contract_title || '示例合同';
      risks = getMockRisks(contract_id);
      contractText = buildContractTextFromRisks(risks);
    } else if (!contractText && risks.length > 0) {
      // 有风险数据但无合同全文，用风险条款构建
      contractText = buildContractTextFromRisks(risks);
    }

    // ===== 调用AI回答 =====
    if (isClaudeConfigured() && contractText) {
      // 完整模式：调用Claude API
      try {
        const result = await askContractQuestion(contractText, question, history);
        return NextResponse.json({
          answer: result.answer,
          references: result.references,
          mock: false,
        });
      } catch (err) {
        // Claude调用失败，回退到演示模式
        console.error('Claude QA failed, fallback to demo:', err);
        const demo = generateDemoAnswer(question, risks);
        return NextResponse.json({
          answer: demo.answer,
          references: demo.references,
          mock: true,
        });
      }
    }

    // 演示模式：基于关键词匹配生成回答
    await new Promise(resolve => setTimeout(resolve, 800)); // 模拟思考延迟
    const demo = generateDemoAnswer(question, risks);
    return NextResponse.json({
      answer: demo.answer,
      references: demo.references,
      mock: true,
    });

  } catch (err) {
    console.error('QA API error:', err);
    return NextResponse.json({
      error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}`
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'QA API is running',
  });
}
