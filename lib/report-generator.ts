// ===== 审查报告生成模块 =====
// 生成HTML格式和纯文本格式的合同审查报告

import { ReviewReport, ContractRisk, RISK_TYPE_LABELS, RISK_LEVEL_CONFIG } from './types';

// 格式化日期时间
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 转义HTML特殊字符，防止XSS及排版错乱
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 根据风险评分获取等级标签和颜色
function getScoreLevel(score: number): { label: string; color: string } {
  if (score >= 60) return { label: '高风险', color: '#dc2626' };
  if (score >= 40) return { label: '中风险', color: '#d97706' };
  return { label: '低风险', color: '#16a34a' };
}

// 审批状态中文映射
const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: '待审批',
  in_progress: '审批中',
  approved: '已通过',
  rejected: '已拒绝',
};

// 生成单个风险项的HTML片段
function renderRiskItemHTML(risk: ContractRisk, index: number): string {
  const levelConfig = RISK_LEVEL_CONFIG[risk.risk_level];
  const typeLabel = RISK_TYPE_LABELS[risk.risk_type] || risk.risk_type;
  const decisionLabels: Record<string, string> = {
    accepted: '已采纳',
    rejected: '已驳回',
    pending: '待处理',
  };
  const decisionColors: Record<string, string> = {
    accepted: '#16a34a',
    rejected: '#dc2626',
    pending: '#6b7280',
  };

  return `
    <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; page-break-inside: avoid;">
      <!-- 风险头部 -->
      <div style="padding: 16px 20px; background: ${levelConfig.bg}; border-bottom: 1px solid ${levelConfig.color}22;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px; font-weight: 700; color: ${levelConfig.color};">风险 ${index + 1}</span>
            <span style="display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; color: ${levelConfig.color}; background: #ffffff;">
              ${levelConfig.label}
            </span>
            <span style="display: inline-block; padding: 2px 10px; border-radius: 6px; font-size: 12px; color: #475569; background: #f1f5f9;">
              ${escapeHtml(typeLabel)}
            </span>
            <span style="font-size: 13px; color: #64748b;">${escapeHtml(risk.clause_id)}</span>
          </div>
          <span style="font-size: 12px; font-weight: 600; color: ${decisionColors[risk.user_decision]};">
            ${decisionLabels[risk.user_decision] || '待处理'}
          </span>
        </div>
      </div>

      <!-- 风险详情 -->
      <div style="padding: 16px 20px;">
        <!-- 条款原文 -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 6px;">条款原文</div>
          <div style="padding: 12px 16px; background: #f8fafc; border-left: 3px solid #cbd5e1; border-radius: 6px; font-size: 14px; line-height: 1.8; color: #334155;">
            ${escapeHtml(risk.clause_text)}
          </div>
        </div>

        <!-- 风险说明 -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 600; color: ${levelConfig.color}; margin-bottom: 6px;">风险说明</div>
          <div style="font-size: 14px; line-height: 1.8; color: #334155;">
            ${escapeHtml(risk.risk_explanation)}
          </div>
        </div>

        <!-- 修改建议 -->
        ${risk.suggested_redline ? `
          <div style="margin-bottom: 12px;">
            <div style="font-size: 13px; font-weight: 600; color: #7c3aed; margin-bottom: 6px;">修改建议</div>
            <div style="padding: 12px 16px; background: #f5f3ff; border-left: 3px solid #7c3aed; border-radius: 6px; font-size: 14px; line-height: 1.8; color: #4c1d95;">
              ${escapeHtml(risk.suggested_redline)}
            </div>
          </div>
        ` : ''}

        <!-- 条款标注 -->
        <div style="font-size: 12px; color: #94a3b8;">
          ${risk.is_standard_clause
            ? '此条款符合市场惯例，风险较低'
            : '此条款偏离市场惯例，需重点关注'}
          ${!risk.citation_verified ? ' ｜ 引用待验证' : ''}
        </div>
      </div>
    </div>`;
}

/**
 * 生成HTML格式的完整审查报告
 * 包含内联CSS样式，专业美观，适合打印
 */
export function generateReportHTML(report: ReviewReport): string {
  const scoreLevel = getScoreLevel(report.risk_score);
  const totalRisks = report.risks.length;
  const acceptedCount = report.risks.filter(r => r.user_decision === 'accepted').length;
  const rejectedCount = report.risks.filter(r => r.user_decision === 'rejected').length;
  const pendingCount = report.risks.filter(r => r.user_decision === 'pending').length;

  // 按风险等级排序：高 > 中 > 低
  const levelOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sortedRisks = [...report.risks].sort((a, b) => levelOrder[a.risk_level] - levelOrder[b.risk_level]);

  // 审批状态
  const approvalLabel = report.approval_status
    ? APPROVAL_STATUS_LABELS[report.approval_status] || report.approval_status
    : '未生成审批流';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.contract_title)} - 合同审查报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, "Microsoft YaHei", sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1e293b;
      background: #ffffff;
      padding: 40px;
    }
    .report-container {
      max-width: 800px;
      margin: 0 auto;
    }
    /* 报告头部 */
    .report-header {
      text-align: center;
      padding-bottom: 32px;
      border-bottom: 3px solid #7c3aed;
      margin-bottom: 32px;
    }
    .report-header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .report-header .subtitle {
      font-size: 15px;
      color: #64748b;
    }
    .report-header .meta {
      margin-top: 16px;
      font-size: 12px;
      color: #94a3b8;
    }
    /* 章节标题 */
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      padding-bottom: 8px;
      border-bottom: 2px solid #ede9fe;
      margin-bottom: 16px;
      margin-top: 32px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #7c3aed;
    }
    /* 合同信息卡片 */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .info-item {
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .info-item .label {
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .info-item .value {
      font-size: 14px;
      font-weight: 600;
      color: #334155;
      word-break: break-all;
    }
    /* 风险评分摘要 */
    .score-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px;
      background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
      border-radius: 16px;
      margin-bottom: 24px;
    }
    .score-circle {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 6px solid ${scoreLevel.color};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }
    .score-circle .score-value {
      font-size: 32px;
      font-weight: 700;
      color: ${scoreLevel.color};
      line-height: 1;
    }
    .score-circle .score-unit {
      font-size: 11px;
      color: #94a3b8;
    }
    .score-summary .score-info {
      flex: 1;
      margin-left: 24px;
    }
    .score-summary .score-label {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .score-summary .score-level {
      font-size: 22px;
      font-weight: 700;
      color: ${scoreLevel.color};
      margin-bottom: 8px;
    }
    /* 风险分布统计 */
    .risk-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 8px;
    }
    .risk-stat-card {
      padding: 16px;
      border-radius: 12px;
      text-align: center;
    }
    .risk-stat-card .stat-value {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
    }
    .risk-stat-card .stat-label {
      font-size: 13px;
      margin-top: 6px;
    }
    /* 决策统计条 */
    .decision-bar {
      display: flex;
      gap: 16px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
      font-size: 13px;
      color: #64748b;
      margin-top: 12px;
    }
    .decision-bar strong { font-weight: 700; }
    /* 审批状态 */
    .approval-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
    }
    /* 总结 */
    .summary-box {
      padding: 16px 20px;
      background: #f8fafc;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.8;
      color: #334155;
      border-left: 4px solid #7c3aed;
    }
    /* 页脚 */
    .report-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
    /* 打印优化 */
    @media print {
      body { padding: 20px; }
      .report-container { max-width: 100%; }
      @page { margin: 2cm; }
    }
  </style>
</head>
<body>
  <div class="report-container">

    <!-- ===== 报告标题 ===== -->
    <div class="report-header">
      <h1>合同智能审查报告</h1>
      <div class="subtitle">${escapeHtml(report.contract_title)}</div>
      <div class="meta">
        报告编号：${escapeHtml(report.report_id)} ｜ 生成时间：${escapeHtml(formatDateTime(report.generated_at))}
      </div>
    </div>

    <!-- ===== 合同信息 ===== -->
    <div class="section-title"><span class="dot"></span>合同信息</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="label">合同名称</div>
        <div class="value">${escapeHtml(report.contract_title)}</div>
      </div>
      <div class="info-item">
        <div class="label">合同类型</div>
        <div class="value">${escapeHtml(report.contract_type)}</div>
      </div>
      <div class="info-item">
        <div class="label">文件名称</div>
        <div class="value">${escapeHtml(report.filename)}</div>
      </div>
      <div class="info-item">
        <div class="label">审查日期</div>
        <div class="value">${escapeHtml(formatDateTime(report.review_date))}</div>
      </div>
      <div class="info-item">
        <div class="label">合同编号</div>
        <div class="value">${escapeHtml(report.contract_id)}</div>
      </div>
      <div class="info-item">
        <div class="label">风险总数</div>
        <div class="value">${totalRisks} 项</div>
      </div>
    </div>

    <!-- ===== 风险评分摘要 ===== -->
    <div class="section-title"><span class="dot"></span>风险评分摘要</div>
    <div class="score-summary">
      <div class="score-circle">
        <div class="score-value">${report.risk_score}</div>
        <div class="score-unit">/ 100</div>
      </div>
      <div class="score-info">
        <div class="score-label">综合风险评分</div>
        <div class="score-level">${scoreLevel.label}</div>
        <div style="font-size: 13px; color: #64748b; line-height: 1.6;">
          ${report.risk_score >= 60 ? '本合同存在较高风险，建议在签署前重点修改高风险条款。' :
            report.risk_score >= 40 ? '本合同存在中等风险，建议关注并酌情修改相关条款。' :
            '本合同风险较低，整体条款较为合理。'}
        </div>
      </div>
    </div>

    <!-- ===== 风险分布统计 ===== -->
    <div class="section-title"><span class="dot"></span>风险分布统计</div>
    <div class="risk-stats">
      <div class="risk-stat-card" style="background: #fef2f2; border: 1px solid #fecaca;">
        <div class="stat-value" style="color: #dc2626;">${report.high_risk_count}</div>
        <div class="stat-label" style="color: #dc2626;">高风险</div>
      </div>
      <div class="risk-stat-card" style="background: #fffbeb; border: 1px solid #fde68a;">
        <div class="stat-value" style="color: #d97706;">${report.medium_risk_count}</div>
        <div class="stat-label" style="color: #d97706;">中风险</div>
      </div>
      <div class="risk-stat-card" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
        <div class="stat-value" style="color: #16a34a;">${report.low_risk_count}</div>
        <div class="stat-label" style="color: #16a34a;">低风险</div>
      </div>
    </div>
    <div class="decision-bar">
      <span>已采纳 <strong style="color: #16a34a;">${acceptedCount}</strong> 项</span>
      <span>已驳回 <strong style="color: #dc2626;">${rejectedCount}</strong> 项</span>
      <span>待处理 <strong style="color: #64748b;">${pendingCount}</strong> 项</span>
    </div>

    <!-- ===== 审查总结 ===== -->
    ${report.summary ? `
    <div class="section-title"><span class="dot"></span>审查总结</div>
    <div class="summary-box">${escapeHtml(report.summary)}</div>
    ` : ''}

    <!-- ===== 风险详情 ===== -->
    <div class="section-title"><span class="dot"></span>风险详情（共 ${totalRisks} 项）</div>
    ${sortedRisks.length > 0
      ? sortedRisks.map((risk, idx) => renderRiskItemHTML(risk, idx)).join('')
      : '<p style="padding: 24px; text-align: center; color: #94a3b8;">未发现风险项</p>'
    }

    <!-- ===== 审批状态 ===== -->
    <div class="section-title"><span class="dot"></span>审批状态</div>
    <div class="approval-status" style="background: #f8fafc; border: 1px solid #e2e8f0;">
      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${
        report.approval_status === 'approved' ? '#16a34a' :
        report.approval_status === 'rejected' ? '#dc2626' :
        report.approval_status === 'in_progress' ? '#d97706' : '#64748b'
      };"></span>
      ${escapeHtml(approvalLabel)}
    </div>

    <!-- ===== 页脚 ===== -->
    <div class="report-footer">
      本报告由企业合同智能审查Agent自动生成<br>
      生成时间：${escapeHtml(formatDateTime(report.generated_at))} ｜ 报告编号：${escapeHtml(report.report_id)}
    </div>

  </div>
</body>
</html>`;
}

/**
 * 生成纯文本格式的审查报告
 */
export function generateReportText(report: ReviewReport): string {
  const scoreLevel = getScoreLevel(report.risk_score);
  const totalRisks = report.risks.length;
  const acceptedCount = report.risks.filter(r => r.user_decision === 'accepted').length;
  const rejectedCount = report.risks.filter(r => r.user_decision === 'rejected').length;
  const pendingCount = report.risks.filter(r => r.user_decision === 'pending').length;

  // 按风险等级排序：高 > 中 > 低
  const levelOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sortedRisks = [...report.risks].sort((a, b) => levelOrder[a.risk_level] - levelOrder[b.risk_level]);

  const approvalLabel = report.approval_status
    ? APPROVAL_STATUS_LABELS[report.approval_status] || report.approval_status
    : '未生成审批流';

  let text = '';
  const separator = '='.repeat(60);
  const thinSeparator = '-'.repeat(60);

  // 报告标题
  text += separator + '\n';
  text += '              合同智能审查报告\n';
  text += separator + '\n\n';

  // 合同信息
  text += '【合同信息】\n';
  text += thinSeparator + '\n';
  text += `合同名称：${report.contract_title}\n`;
  text += `合同类型：${report.contract_type}\n`;
  text += `文件名称：${report.filename}\n`;
  text += `审查日期：${formatDateTime(report.review_date)}\n`;
  text += `合同编号：${report.contract_id}\n`;
  text += `报告编号：${report.report_id}\n`;
  text += `生成时间：${formatDateTime(report.generated_at)}\n\n`;

  // 风险评分摘要
  text += '【风险评分摘要】\n';
  text += thinSeparator + '\n';
  text += `综合风险评分：${report.risk_score} / 100（${scoreLevel.label}）\n`;
  if (report.risk_score >= 60) {
    text += '评估结论：本合同存在较高风险，建议在签署前重点修改高风险条款。\n';
  } else if (report.risk_score >= 40) {
    text += '评估结论：本合同存在中等风险，建议关注并酌情修改相关条款。\n';
  } else {
    text += '评估结论：本合同风险较低，整体条款较为合理。\n';
  }
  text += '\n';

  // 风险分布统计
  text += '【风险分布统计】\n';
  text += thinSeparator + '\n';
  text += `高风险：${report.high_risk_count} 项\n`;
  text += `中风险：${report.medium_risk_count} 项\n`;
  text += `低风险：${report.low_risk_count} 项\n`;
  text += `风险总数：${totalRisks} 项\n`;
  text += `已采纳：${acceptedCount} 项 ｜ 已驳回：${rejectedCount} 项 ｜ 待处理：${pendingCount} 项\n\n`;

  // 审查总结
  if (report.summary) {
    text += '【审查总结】\n';
    text += thinSeparator + '\n';
    text += report.summary + '\n\n';
  }

  // 风险详情
  text += '【风险详情】\n';
  text += thinSeparator + '\n\n';

  if (sortedRisks.length === 0) {
    text += '未发现风险项\n\n';
  } else {
    sortedRisks.forEach((risk, idx) => {
      const levelConfig = RISK_LEVEL_CONFIG[risk.risk_level];
      const typeLabel = RISK_TYPE_LABELS[risk.risk_type] || risk.risk_type;
      const decisionLabels: Record<string, string> = {
        accepted: '已采纳',
        rejected: '已驳回',
        pending: '待处理',
      };

      text += `--- 风险 ${idx + 1} ---\n`;
      text += `风险等级：${levelConfig.label}\n`;
      text += `风险类型：${typeLabel}\n`;
      text += `条款编号：${risk.clause_id}\n`;
      text += `处理状态：${decisionLabels[risk.user_decision] || '待处理'}\n`;
      text += `条款原文：${risk.clause_text}\n`;
      text += `风险说明：${risk.risk_explanation}\n`;
      if (risk.suggested_redline) {
        text += `修改建议：${risk.suggested_redline}\n`;
      }
      text += `条款标注：${risk.is_standard_clause ? '符合市场惯例' : '偏离市场惯例'}${!risk.citation_verified ? '（引用待验证）' : ''}\n`;
      text += '\n';
    });
  }

  // 审批状态
  text += '【审批状态】\n';
  text += thinSeparator + '\n';
  text += `审批状态：${approvalLabel}\n\n`;

  // 页脚
  text += separator + '\n';
  text += '本报告由企业合同智能审查Agent自动生成\n';
  text += `生成时间：${formatDateTime(report.generated_at)}\n`;
  text += separator + '\n';

  return text;
}
