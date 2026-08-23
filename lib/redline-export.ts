// ===== Redline导出模块 =====
// 生成带修订标记的Word文档（Track Changes格式）

import { ContractRisk, RISK_TYPE_LABELS } from './types';
import { ClauseComparisonResult } from './types';

// 生成Redline HTML文档（可在浏览器中下载为.doc）
export function generateRedlineHTML(
  contractTitle: string,
  contractType: string,
  risks: ContractRisk[],
  comparison?: ClauseComparisonResult,
  acceptedRiskIds: string[] = []
): string {
  const acceptedRisks = risks.filter(r => acceptedRiskIds.includes(r.id) || r.user_decision === 'accepted');
  const rejectedRisks = risks.filter(r => r.user_decision === 'rejected');
  const pendingRisks = risks.filter(r => r.user_decision === 'pending');

  // 生成风险条款的修订标记
  const riskRedlines = acceptedRisks.map(risk => {
    const riskLabel = RISK_TYPE_LABELS[risk.risk_type] || risk.risk_type;
    return `
      <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="font-weight: bold; color: #7c3aed; margin-bottom: 8px;">
          ${risk.clause_id} — ${riskLabel}
        </div>
        <div style="background: #fef2f2; padding: 10px; text-decoration: line-through; color: #991b1b; margin-bottom: 8px;">
          ${risk.clause_text}
        </div>
        <div style="background: #f0fdf4; padding: 10px; color: #166534;">
          ${risk.suggested_redline || '（无修改建议）'}
        </div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">
          修改原因：${risk.risk_explanation}
        </div>
      </div>`;
  }).join('');

  // 生成条款比对结果
  const comparisonSection = comparison ? `
    <h2 style="color: #7c3aed; border-bottom: 2px solid #ede9fe; padding-bottom: 8px; margin-top: 32px;">
      条款比对分析
    </h2>
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
      <thead>
        <tr style="background: #f5f3ff;">
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">条款编号</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">差异类型</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">关键差异</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">建议</th>
        </tr>
      </thead>
      <tbody>
        ${comparison.diffs.map(d => `
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${d.clause_id}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">
              <span style="color: ${d.diff_type === 'removed' ? '#dc2626' : d.diff_type === 'modified' ? '#d97706' : d.diff_type === 'added' ? '#2563eb' : '#16a34a'}">
                ${d.diff_type === 'removed' ? '缺失' : d.diff_type === 'modified' ? '已修改' : d.diff_type === 'added' ? '额外' : '一致'}
              </span>
            </td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${d.key_differences.join('；')}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${d.suggestion}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : '';

  // 生成完整HTML
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${contractTitle} - 审查修订报告</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:TrackChanges/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif; font-size: 14px; line-height: 1.8; }
    h1 { color: #7c3aed; font-size: 22px; }
    h2 { color: #7c3aed; font-size: 18px; }
    .strike { text-decoration: line-through; color: #991b1b; }
    .insert { color: #166534; }
    .meta { color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${contractTitle}</h1>
  <div style="margin-bottom: 24px;">
    <span style="color: #6b7280; margin-right: 16px;">合同类型：${contractType}</span>
    <span style="color: #6b7280; margin-right: 16px;">审查日期：${new Date().toLocaleDateString('zh-CN')}</span>
    <span style="color: #6b7280;">风险评分：${risks.length > 0 ? Math.round(risks.reduce((sum, r) => sum + (r.risk_level === 'high' ? 80 : r.risk_level === 'medium' ? 50 : 20), 0) / risks.length) : 0}/100</span>
  </div>

  <h2 style="border-bottom: 2px solid #ede9fe; padding-bottom: 8px;">
    AI审查修订建议（已采纳 ${acceptedRisks.length} 项）
  </h2>

  ${riskRedlines || '<p style="color: #6b7280;">暂无已采纳的修改建议</p>'}

  ${rejectedRisks.length > 0 ? `
    <h2 style="color: #dc2626; border-bottom: 2px solid #fef2f2; padding-bottom: 8px; margin-top: 32px;">
      已驳回的建议（${rejectedRisks.length} 项）
    </h2>
    ${rejectedRisks.map(r => `
      <div style="margin-bottom: 12px; padding: 10px; background: #f9fafb; border-left: 3px solid #d1d5db;">
        <div style="font-weight: 600;">${r.clause_id}</div>
        <div style="font-size: 12px; color: #6b7280;">${r.risk_explanation}</div>
      </div>
    `).join('')}
  ` : ''}

  ${pendingRisks.length > 0 ? `
    <h2 style="color: #d97706; border-bottom: 2px solid #fffbeb; padding-bottom: 8px; margin-top: 32px;">
      待处理的建议（${pendingRisks.length} 项）
    </h2>
    ${pendingRisks.map(r => `
      <div style="margin-bottom: 12px; padding: 10px; background: #fffbeb; border-left: 3px solid #f59e0b;">
        <div style="font-weight: 600;">${r.clause_id}</div>
        <div style="font-size: 12px; color: #6b7280;">${r.risk_explanation}</div>
      </div>
    `).join('')}
  ` : ''}

  ${comparisonSection}

  <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
    本报告由企业合同智能审查Agent自动生成 | 生成时间：${new Date().toLocaleString('zh-CN')}
  </div>
</body>
</html>`;
}

// 生成纯文本版本的红线报告
export function generateRedlineText(
  contractTitle: string,
  contractType: string,
  risks: ContractRisk[],
  acceptedRiskIds: string[] = []
): string {
  const acceptedRisks = risks.filter(r => acceptedRiskIds.includes(r.id) || r.user_decision === 'accepted');

  let text = `${contractTitle}\n合同类型：${contractType}\n审查日期：${new Date().toLocaleDateString('zh-CN')}\n\n`;
  text += `===== AI审查修订建议（已采纳 ${acceptedRisks.length} 项）=====\n\n`;

  for (const risk of acceptedRisks) {
    const riskLabel = RISK_TYPE_LABELS[risk.risk_type] || risk.risk_type;
    text += `【${risk.clause_id}】${riskLabel}\n`;
    text += `- 原条款：${risk.clause_text}\n`;
    text += `+ 修改为：${risk.suggested_redline || '（无修改建议）'}\n`;
    text += `  修改原因：${risk.risk_explanation}\n\n`;
  }

  text += `\n本报告由企业合同智能审查Agent自动生成\n`;
  return text;
}
