// ===== 开放 API 文档数据 =====
// 提供项目所有 API 端点的结构化文档，供 /api-docs 页面渲染

import { ApiEndpointDoc } from './types';

// 返回所有 API 端点文档
export function getApiEndpoints(): ApiEndpointDoc[] {
  return [
    // ===== 合同审查 =====
    {
      method: 'POST',
      path: '/api/review',
      summary: '合同审查',
      description:
        '上传单个合同文件（PDF / Word / 文本），系统自动解析文档、识别合同类型，调用 AI 在数秒内完成风险条款识别并返回审查结果，包括风险评分、风险数量及修改建议。',
      request_params: [
        {
          name: 'file',
          type: 'File (FormData)',
          required: true,
          description: '合同文件，支持 .pdf、.docx、.txt 格式，单文件不超过 10MB。',
        },
      ],
      response_fields: [
        { name: 'reviewId', type: 'string', description: '审查记录唯一 ID，用于后续查询与报告导出。' },
        { name: 'contract_type', type: 'string', description: 'AI 识别的合同类型，如「采购合同」。' },
        { name: 'contract_title', type: 'string', description: 'AI 提取的合同标题。' },
        { name: 'risk_score', type: 'number', description: '整体风险评分（0-100），越高风险越大。' },
        { name: 'risk_count', type: 'number', description: '识别出的风险条款总数。' },
        { name: 'high_risk_count', type: 'number', description: '高风险条款数量。' },
        { name: 'summary', type: 'string', description: 'AI 生成的审查摘要。' },
        { name: 'mock', type: 'boolean', description: '是否为演示模式（未配置 Claude API 时为 true）。' },
      ],
      example_request: `curl -X POST http://localhost:3000/api/review \\
  -F "file=@采购合同.pdf"`,
      example_response: `{
  "reviewId": "a1b2c3d4-5678-90ef-...",
  "contract_type": "采购合同",
  "contract_title": "XX公司办公用品采购合同",
  "risk_score": 72,
  "risk_count": 8,
  "high_risk_count": 3,
  "summary": "该合同在付款条款、违约责任等方面存在较高风险，建议修改后签署。",
  "mock": false
}`,
    },
    {
      method: 'POST',
      path: '/api/batch-review',
      summary: '批量审查',
      description:
        '上传多个合同文件，系统并行执行解析与审查逻辑，统一返回每个文件的审查结果。单次最多支持 20 个文件，每个文件不超过 10MB。',
      request_params: [
        {
          name: 'files',
          type: 'File[] (FormData 多文件)',
          required: true,
          description: '多个合同文件，通过 FormData 的 files 字段上传，最多 20 个。',
        },
      ],
      response_fields: [
        { name: 'total', type: 'number', description: '本次批量审查的文件总数。' },
        { name: 'completed', type: 'number', description: '审查成功的文件数。' },
        { name: 'failed', type: 'number', description: '审查失败的文件数。' },
        {
          name: 'items',
          type: 'BatchReviewItem[]',
          description: '每个文件的审查结果数组，包含 id、filename、status、contract_type、risk_score、risk_count、high_risk_count、reviewId 等。',
        },
      ],
      example_request: `curl -X POST http://localhost:3000/api/batch-review \\
  -F "files=@合同1.pdf" \\
  -F "files=@合同2.docx"`,
      example_response: `{
  "total": 2,
  "completed": 2,
  "failed": 0,
  "items": [
    {
      "id": "1716000000-0",
      "filename": "合同1.pdf",
      "status": "completed",
      "contract_type": "采购合同",
      "risk_score": 65,
      "risk_count": 5,
      "high_risk_count": 1,
      "reviewId": "mock-1716000000-0"
    },
    {
      "id": "1716000000-1",
      "filename": "合同2.docx",
      "status": "completed",
      "contract_type": "服务合同",
      "risk_score": 48,
      "risk_count": 3,
      "high_risk_count": 0,
      "reviewId": "mock-1716000000-1"
    }
  ]
}`,
    },

    // ===== 条款分析 =====
    {
      method: 'POST',
      path: '/api/comparison',
      summary: '条款比对',
      description:
        '将指定合同与标准条款库进行逐条比对，识别缺失、修改及多余条款，评估差异风险并给出修改建议。',
      request_params: [
        { name: 'contractId', type: 'string', required: true, description: '合同 ID。' },
        {
          name: 'contractText',
          type: 'string',
          required: false,
          description: '合同正文文本，长度大于 50 时执行真实比对，否则返回演示比对结果。',
        },
        { name: 'contractType', type: 'string', required: false, description: '合同类型，未提供时自动检测。' },
      ],
      response_fields: [
        { name: 'contract_id', type: 'string', description: '合同 ID。' },
        { name: 'contract_type', type: 'string', description: '合同类型。' },
        { name: 'total_clauses', type: 'number', description: '条款总数。' },
        { name: 'matched_clauses', type: 'number', description: '与标准匹配的条款数。' },
        { name: 'modified_clauses', type: 'number', description: '被修改的条款数。' },
        { name: 'missing_clauses', type: 'number', description: '缺失的标准条款数。' },
        { name: 'extra_clauses', type: 'number', description: '多出的非标准条款数。' },
        { name: 'diffs', type: 'ClauseDiff[]', description: '条款差异明细数组。' },
        { name: 'summary', type: 'string', description: '比对摘要。' },
      ],
      example_request: `curl -X POST http://localhost:3000/api/comparison \\
  -H "Content-Type: application/json" \\
  -d '{
    "contractId": "mock-001",
    "contractText": "甲方应在收货后30日内付款...",
    "contractType": "采购合同"
  }'`,
      example_response: `{
  "contract_id": "mock-001",
  "contract_type": "采购合同",
  "total_clauses": 12,
  "matched_clauses": 8,
  "modified_clauses": 3,
  "missing_clauses": 1,
  "extra_clauses": 0,
  "diffs": [
    {
      "clause_id": "c-3",
      "original_text": "甲方应在收货后30日内付款",
      "standard_text": "甲方应在收货后15日内付款",
      "diff_type": "modified",
      "similarity": 85,
      "key_differences": ["付款期限由15日延长至30日"],
      "risk_assessment": "中风险：付款周期延长影响资金回笼",
      "suggestion": "建议将付款期限缩短至15日"
    }
  ],
  "summary": "该合同与标准模板整体匹配度较高，3处条款存在修改。"
}`,
    },
    {
      method: 'POST',
      path: '/api/contract-diff',
      summary: '合同对比',
      description:
        '对两份合同（文本 A 与文本 B）进行逐条对比分析，输出整体相似度、条款差异明细及各自独有的风险，常用于版本对比与跨合同分析。',
      request_params: [
        { name: 'text_a', type: 'string', required: true, description: '合同 A 的正文文本。' },
        { name: 'text_b', type: 'string', required: true, description: '合同 B 的正文文本。' },
        { name: 'title_a', type: 'string', required: false, description: '合同 A 的标题。' },
        { name: 'title_b', type: 'string', required: false, description: '合同 B 的标题。' },
        { name: 'type_a', type: 'string', required: false, description: '合同 A 的类型。' },
        { name: 'type_b', type: 'string', required: false, description: '合同 B 的类型。' },
      ],
      response_fields: [
        { name: 'contract_a', type: 'object', description: '合同 A 的概要信息（id、title、type）。' },
        { name: 'contract_b', type: 'object', description: '合同 B 的概要信息（id、title、type）。' },
        { name: 'summary', type: 'string', description: '对比摘要。' },
        { name: 'overall_similarity', type: 'number', description: '整体相似度（0-100）。' },
        { name: 'items', type: 'ContractComparisonItem[]', description: '条款对比明细数组。' },
        { name: 'unique_risks_a', type: 'string[]', description: '合同 A 独有的风险。' },
        { name: 'unique_risks_b', type: 'string[]', description: '合同 B 独有的风险。' },
      ],
      example_request: `curl -X POST http://localhost:3000/api/contract-diff \\
  -H "Content-Type: application/json" \\
  -d '{
    "text_a": "甲方应在收货后30日内付款...",
    "text_b": "甲方应在收货后15日内付款...",
    "title_a": "合同版本A",
    "title_b": "合同版本B"
  }'`,
      example_response: `{
  "contract_a": { "id": "a", "title": "合同版本A", "type": "采购合同" },
  "contract_b": { "id": "b", "title": "合同版本B", "type": "采购合同" },
  "summary": "两份合同整体相似度88%，主要差异在付款条款。",
  "overall_similarity": 88,
  "items": [
    {
      "clause_label": "付款条款",
      "contract_a_text": "甲方应在收货后30日内付款",
      "contract_b_text": "甲方应在收货后15日内付款",
      "diff_type": "modified",
      "similarity": 85,
      "key_differences": ["付款期限不同"],
      "risk_implication": "版本A的付款周期更长，资金风险较高"
    }
  ],
  "unique_risks_a": ["付款周期过长"],
  "unique_risks_b": []
}`,
    },

    // ===== 审批与决策 =====
    {
      method: 'POST',
      path: '/api/approval',
      summary: '审批流程',
      description:
        '审批流程管理。通过 action 参数区分操作：create 根据合同风险等级创建审批流并自动路由；advance 推进当前审批节点。返回完整的审批流及各节点状态。',
      request_params: [
        {
          name: 'action',
          type: 'string',
          required: true,
          description: '操作类型：create（创建审批流）或 advance（推进审批流）。',
        },
        { name: 'contractId', type: 'string', required: true, description: '合同 ID（create 时必填）。' },
        { name: 'riskScore', type: 'number', required: false, description: '风险评分（演示模式创建时使用）。' },
        { name: 'highRiskCount', type: 'number', required: false, description: '高风险数量（演示模式创建时使用）。' },
        { name: 'flow', type: 'object', required: false, description: '当前审批流对象（advance 时必填）。' },
        { name: 'decision', type: 'string', required: false, description: '审批决策：approved / rejected / skipped（advance 时必填）。' },
        { name: 'approverName', type: 'string', required: false, description: '审批人姓名。' },
        { name: 'comment', type: 'string', required: false, description: '审批意见。' },
      ],
      response_fields: [
        { name: 'id', type: 'string', description: '审批流 ID。' },
        { name: 'contract_id', type: 'string', description: '合同 ID。' },
        { name: 'nodes', type: 'ApprovalNode[]', description: '审批节点数组，含角色、状态、审批人、意见等。' },
        { name: 'current_node', type: 'number', description: '当前节点序号。' },
        { name: 'status', type: 'string', description: '审批流状态：pending / in_progress / approved / rejected。' },
        { name: 'route_reason', type: 'string', description: '路由原因：high_risk / medium_risk / low_risk / auto_approved。' },
        { name: 'auto_approved', type: 'boolean', description: '是否自动通过。' },
        { name: 'created_at', type: 'string', description: '创建时间。' },
        { name: 'completed_at', type: 'string', description: '完成时间（未完成时为 null）。' },
      ],
      example_request: `curl -X POST http://localhost:3000/api/approval \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "create",
    "contractId": "mock-001",
    "riskScore": 72,
    "highRiskCount": 3
  }'`,
      example_response: `{
  "id": "flow-1716000000",
  "contract_id": "mock-001",
  "nodes": [
    {
      "id": "node-0",
      "order": 0,
      "role": "legal_specialist",
      "role_label": "法务专员",
      "status": "in_progress",
      "route_reason": "high_risk",
      "created_at": "2026-08-20T10:00:00.000Z"
    },
    {
      "id": "node-1",
      "order": 1,
      "role": "legal_manager",
      "role_label": "法务经理",
      "status": "pending",
      "route_reason": "high_risk",
      "created_at": "2026-08-20T10:00:00.000Z"
    }
  ],
  "current_node": 0,
  "status": "in_progress",
  "route_reason": "high_risk",
  "auto_approved": false,
  "created_at": "2026-08-20T10:00:00.000Z"
}`,
    },
    {
      method: 'POST',
      path: '/api/decision',
      summary: '风险决策',
      description:
        '对 AI 给出的风险修改建议进行逐条决策，用户可选择采纳（accepted）或驳回（rejected），系统更新风险项状态并记录审计日志。',
      request_params: [
        { name: 'riskId', type: 'string', required: true, description: '风险项 ID。' },
        {
          name: 'decision',
          type: 'string',
          required: true,
          description: '决策结果：accepted（采纳）或 rejected（驳回）。',
        },
        { name: 'contractId', type: 'string', required: false, description: '合同 ID（用于审计日志关联）。' },
      ],
      response_fields: [
        { name: 'success', type: 'boolean', description: '操作是否成功。' },
        { name: 'riskId', type: 'string', description: '风险项 ID。' },
        { name: 'decision', type: 'string', description: '决策结果：accepted / rejected。' },
        { name: 'mock', type: 'boolean', description: '是否为演示模式。' },
      ],
      example_request: `curl -X POST http://localhost:3000/api/decision \\
  -H "Content-Type: application/json" \\
  -d '{
    "riskId": "risk-001",
    "decision": "accepted",
    "contractId": "mock-001"
  }'`,
      example_response: `{
  "success": true,
  "riskId": "risk-001",
  "decision": "accepted",
  "mock": false
}`,
    },

    // ===== 协作与问答 =====
    {
      method: 'GET',
      path: '/api/comments',
      summary: '查询评论',
      description:
        '按合同 ID 查询团队协作评论列表，可选按风险 ID 过滤，结果按创建时间升序返回。',
      request_params: [
        { name: 'contract_id', type: 'string (query)', required: true, description: '合同 ID 查询参数。' },
        { name: 'risk_id', type: 'string (query)', required: false, description: '风险 ID，用于过滤该风险下的评论。' },
      ],
      response_fields: [
        { name: 'comments', type: 'ContractComment[]', description: '评论数组，含 id、user_name、user_role、content、mentions、resolved 等。' },
        { name: 'mock', type: 'boolean', description: '是否为演示模式。' },
      ],
      example_request: `curl "http://localhost:3000/api/comments?contract_id=mock-001"`,
      example_response: `{
  "comments": [
    {
      "id": "cmt-a1b2c3d4",
      "contract_id": "mock-001",
      "user_name": "张法务",
      "user_role": "法务专员",
      "content": "建议修改付款期限 @李经理",
      "mentions": ["李经理"],
      "resolved": false,
      "created_at": "2026-08-20T09:30:00.000Z"
    }
  ],
  "mock": true
}`,
    },
    {
      method: 'POST',
      path: '/api/comments',
      summary: '创建评论',
      description:
        '创建评论或回复，自动提取 @提及 并与传入的 mentions 合并去重；也可通过 action=resolve 标记评论已解决。',
      request_params: [
        { name: 'contract_id', type: 'string', required: true, description: '合同 ID。' },
        { name: 'content', type: 'string', required: true, description: '评论内容。' },
        { name: 'user_name', type: 'string', required: true, description: '评论人姓名。' },
        { name: 'user_role', type: 'string', required: false, description: '评论人角色，默认「法务专员」。' },
        { name: 'risk_id', type: 'string', required: false, description: '关联的风险 ID。' },
        { name: 'mentions', type: 'string[]', required: false, description: '@提及列表，系统会自动提取并合并。' },
        { name: 'parent_id', type: 'string', required: false, description: '父评论 ID，用于回复。' },
        { name: 'action', type: 'string', required: false, description: '设为 resolve 时标记评论已解决。' },
        { name: 'comment_id', type: 'string', required: false, description: 'resolve 操作时的目标评论 ID。' },
        { name: 'resolved', type: 'boolean', required: false, description: 'resolve 操作时的目标状态。' },
      ],
      response_fields: [
        { name: 'comment', type: 'ContractComment', description: '创建或更新后的评论对象。' },
        { name: 'mock', type: 'boolean', description: '是否为演示模式。' },
      ],
      example_request: `curl -X POST http://localhost:3000/api/comments \\
  -H "Content-Type: application/json" \\
  -d '{
    "contract_id": "mock-001",
    "content": "这条付款条款风险较高，建议修改 @李经理",
    "user_name": "张法务",
    "user_role": "法务专员"
  }'`,
      example_response: `{
  "comment": {
    "id": "cmt-e5f6a7b8",
    "contract_id": "mock-001",
    "user_id": "u-张法务",
    "user_name": "张法务",
    "user_role": "法务专员",
    "content": "这条付款条款风险较高，建议修改 @李经理",
    "mentions": ["李经理"],
    "resolved": false,
    "created_at": "2026-08-20T09:35:00.000Z"
  },
  "mock": true
}`,
    },
    {
      method: 'POST',
      path: '/api/qa',
      summary: '合同问答',
      description:
        '基于指定合同的上下文进行 AI 问答，返回答案及相关条款引用，支持自然语言提问合同条款、风险、义务等内容。',
      request_params: [
        { name: 'contract_id', type: 'string', required: true, description: '合同 ID。' },
        { name: 'question', type: 'string', required: true, description: '用户提问内容。' },
      ],
      response_fields: [
        { name: 'answer', type: 'string', description: 'AI 生成的回答。' },
        { name: 'references', type: 'array', description: '引用的条款列表，含 clause_id 与 clause_text。' },
        { name: 'contract_id', type: 'string', description: '合同 ID。' },
        { name: 'mock', type: 'boolean', description: '是否为演示模式。' },
      ],
      example_request: `curl -X POST http://localhost:3000/api/qa \\
  -H "Content-Type: application/json" \\
  -d '{
    "contract_id": "mock-001",
    "question": "付款条款的具体期限是多久？"
  }'`,
      example_response: `{
  "answer": "根据合同第3.2条，甲方应在收货后30日内付款。该期限长于标准条款建议的15日，存在资金回笼风险。",
  "references": [
    {
      "clause_id": "c-3",
      "clause_text": "甲方应在收货后30日内付款"
    }
  ],
  "contract_id": "mock-001",
  "mock": true
}`,
    },

    // ===== 预警与通知 =====
    {
      method: 'GET',
      path: '/api/alerts',
      summary: '风险预警列表',
      description:
        '获取风险趋势预警列表，包含严重程度、状态、指标、阈值及当前值等，用于风险态势监控。',
      request_params: [
        { name: 'status', type: 'string (query)', required: false, description: '按状态过滤：active / acknowledged / resolved。' },
        { name: 'severity', type: 'string (query)', required: false, description: '按严重程度过滤：critical / warning / info。' },
      ],
      response_fields: [
        { name: 'alerts', type: 'RiskAlert[]', description: '预警数组，含 id、severity、status、title、metric、threshold、current_value、trend 等。' },
        { name: 'total', type: 'number', description: '预警总数。' },
        { name: 'mock', type: 'boolean', description: '是否为演示模式。' },
      ],
      example_request: `curl "http://localhost:3000/api/alerts?status=active"`,
      example_response: `{
  "alerts": [
    {
      "id": "alert-001",
      "severity": "critical",
      "status": "active",
      "title": "高风险合同比例超标",
      "description": "近7日高风险合同占比超过阈值",
      "metric": "high_risk_ratio",
      "threshold": 0.2,
      "current_value": 0.35,
      "trend": "up",
      "created_at": "2026-08-20T08:00:00.000Z"
    }
  ],
  "total": 1,
  "mock": true
}`,
    },
    {
      method: 'POST',
      path: '/api/alerts',
      summary: '更新预警状态',
      description:
        '确认或解决指定风险预警，更新其状态（acknowledged / resolved）并记录处理时间。',
      request_params: [
        { name: 'alert_id', type: 'string', required: true, description: '预警 ID。' },
        { name: 'status', type: 'string', required: true, description: '目标状态：acknowledged / resolved。' },
      ],
      response_fields: [
        { name: 'alert', type: 'RiskAlert', description: '更新后的预警对象。' },
        { name: 'mock', type: 'boolean', description: '是否为演示模式。' },
      ],
      example_request: `curl -X POST http://localhost:3000/api/alerts \\
  -H "Content-Type: application/json" \\
  -d '{
    "alert_id": "alert-001",
    "status": "acknowledged"
  }'`,
      example_response: `{
  "alert": {
    "id": "alert-001",
    "severity": "critical",
    "status": "acknowledged",
    "title": "高风险合同比例超标",
    "resolved_at": null,
    "created_at": "2026-08-20T08:00:00.000Z"
  },
  "mock": true
}`,
    },
    {
      method: 'GET',
      path: '/api/notifications',
      summary: '通知列表',
      description:
        '获取邮件通知列表，包含事件类型、收件人、主题、正文及发送状态等。',
      request_params: [
        { name: 'event_type', type: 'string (query)', required: false, description: '按事件类型过滤：review_completed / high_risk_detected / approval_required 等。' },
        { name: 'sent', type: 'boolean (query)', required: false, description: '按发送状态过滤。' },
      ],
      response_fields: [
        { name: 'notifications', type: 'EmailNotification[]', description: '通知数组，含 id、event_type、recipient、subject、body、sent 等。' },
        { name: 'total', type: 'number', description: '通知总数。' },
        { name: 'mock', type: 'boolean', description: '是否为演示模式。' },
      ],
      example_request: `curl "http://localhost:3000/api/notifications"`,
      example_response: `{
  "notifications": [
    {
      "id": "notif-001",
      "event_type": "high_risk_detected",
      "recipient": "legal@company.com",
      "recipient_name": "法务团队",
      "subject": "【高风险预警】采购合同审查完成",
      "body": "合同 mock-001 的风险评分为72，存在3项高风险条款，请及时处理。",
      "sent": true,
      "sent_at": "2026-08-20T09:00:00.000Z",
      "created_at": "2026-08-20T09:00:00.000Z"
    }
  ],
  "total": 1,
  "mock": true
}`,
    },
    {
      method: 'POST',
      path: '/api/notifications',
      summary: '发送通知',
      description:
        '根据事件类型发送邮件通知，或标记已有通知为已读。支持审查完成、高风险预警、审批待办等事件触发。',
      request_params: [
        { name: 'event_type', type: 'string', required: true, description: '事件类型：review_completed / high_risk_detected / approval_required 等。' },
        { name: 'recipient', type: 'string', required: true, description: '收件人邮箱。' },
        { name: 'recipient_name', type: 'string', required: false, description: '收件人姓名。' },
        { name: 'contract_id', type: 'string', required: false, description: '关联的合同 ID。' },
        { name: 'contract_title', type: 'string', required: false, description: '关联的合同标题。' },
        { name: 'subject', type: 'string', required: false, description: '通知主题，未提供时按事件类型生成。' },
        { name: 'body', type: 'string', required: false, description: '通知正文，未提供时按事件类型生成。' },
      ],
      response_fields: [
        { name: 'notification', type: 'EmailNotification', description: '创建的通知对象。' },
        { name: 'sent', type: 'boolean', description: '是否已发送。' },
        { name: 'mock', type: 'boolean', description: '是否为演示模式。' },
      ],
      example_request: `curl -X POST http://localhost:3000/api/notifications \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_type": "approval_required",
    "recipient": "manager@company.com",
    "recipient_name": "法务经理",
    "contract_id": "mock-001",
    "contract_title": "采购合同"
  }'`,
      example_response: `{
  "notification": {
    "id": "notif-002",
    "event_type": "approval_required",
    "recipient": "manager@company.com",
    "recipient_name": "法务经理",
    "subject": "【审批待办】采购合同等待您的审批",
    "body": "合同「采购合同」风险评分72，存在3项高风险条款，请尽快审批。",
    "sent": true,
    "sent_at": "2026-08-20T09:30:00.000Z",
    "created_at": "2026-08-20T09:30:00.000Z"
  },
  "sent": true,
  "mock": true
}`,
    },

    // ===== 报告与反馈 =====
    {
      method: 'POST',
      path: '/api/export-report',
      summary: '报告导出',
      description:
        '根据合同 ID 与导出格式生成完整审查报告并返回文件流。支持 HTML 与 TXT 两种格式，浏览器会触发文件下载。',
      request_params: [
        { name: 'contract_id', type: 'string', required: true, description: '合同 ID。' },
        {
          name: 'format',
          type: 'string',
          required: true,
          description: '导出格式：html 或 txt。',
        },
      ],
      response_fields: [
        { name: '[文件流]', type: 'binary', description: '响应体为文件流，Content-Type 为 text/html 或 text/plain，Content-Disposition 触发下载。' },
        { name: '[错误]', type: 'object', description: '失败时返回 JSON：{ error: string }。' },
      ],
      example_request: `curl -X POST http://localhost:3000/api/export-report \\
  -H "Content-Type: application/json" \\
  -d '{
    "contract_id": "mock-001",
    "format": "html"
  }' \\
  -o 审查报告.html`,
      example_response: `// 成功：返回 HTML 或 TXT 文件流，浏览器自动下载
// 响应头：
// Content-Type: text/html; charset=utf-8
// Content-Disposition: attachment; filename="审查报告.html"

// 失败示例：
{
  "error": "未找到合同记录"
}`,
    },
    {
      method: 'GET',
      path: '/api/feedback',
      summary: '查询反馈',
      description:
        '按风险 ID 查询用户对该风险修改建议的反馈记录。',
      request_params: [
        { name: 'riskId', type: 'string (query)', required: false, description: '风险 ID，用于查询特定风险的反馈。' },
      ],
      response_fields: [
        { name: 'feedback', type: 'object | null', description: '反馈对象，含 risk_id、rating、comment、created_at；无反馈时为 null。' },
        { name: 'mock', type: 'boolean', description: '是否为演示模式。' },
      ],
      example_request: `curl "http://localhost:3000/api/feedback?riskId=risk-001"`,
      example_response: `{
  "feedback": {
    "risk_id": "risk-001",
    "contract_id": "mock-001",
    "rating": "helpful",
    "comment": "修改建议很实用",
    "created_at": "2026-08-20T09:00:00.000Z"
  },
  "mock": false
}`,
    },
    {
      method: 'POST',
      path: '/api/feedback',
      summary: '提交反馈',
      description:
        '提交对风险修改建议的反馈，包含评分与可选评论，用于持续优化 AI 审查质量。',
      request_params: [
        { name: 'riskId', type: 'string', required: true, description: '风险项 ID。' },
        {
          name: 'rating',
          type: 'string',
          required: true,
          description: '评分：helpful（有帮助） / partially_helpful（部分有帮助） / not_helpful（无帮助）。',
        },
        { name: 'contractId', type: 'string', required: false, description: '合同 ID。' },
        { name: 'comment', type: 'string', required: false, description: '反馈评论。' },
      ],
      response_fields: [
        { name: 'success', type: 'boolean', description: '提交是否成功。' },
        { name: 'feedback', type: 'object', description: '反馈对象，含 risk_id、contract_id、rating、comment、created_at。' },
      ],
      example_request: `curl -X POST http://localhost:3000/api/feedback \\
  -H "Content-Type: application/json" \\
  -d '{
    "riskId": "risk-001",
    "contractId": "mock-001",
    "rating": "helpful",
    "comment": "修改建议很实用"
  }'`,
      example_response: `{
  "success": true,
  "feedback": {
    "risk_id": "risk-001",
    "contract_id": "mock-001",
    "rating": "helpful",
    "comment": "修改建议很实用",
    "created_at": "2026-08-20T09:00:00.000Z"
  }
}`,
    },
  ];
}

// 按分类返回 API 端点
export function getApiCategories(): { name: string; endpoints: ApiEndpointDoc[] }[] {
  const endpoints = getApiEndpoints();
  return [
    {
      name: '合同审查',
      endpoints: endpoints.filter((e) =>
        ['/api/review', '/api/batch-review'].includes(e.path)
      ),
    },
    {
      name: '条款分析',
      endpoints: endpoints.filter((e) =>
        ['/api/comparison', '/api/contract-diff'].includes(e.path)
      ),
    },
    {
      name: '审批与决策',
      endpoints: endpoints.filter((e) =>
        ['/api/approval', '/api/decision'].includes(e.path)
      ),
    },
    {
      name: '协作与问答',
      endpoints: endpoints.filter((e) =>
        ['/api/comments', '/api/qa'].includes(e.path)
      ),
    },
    {
      name: '预警与通知',
      endpoints: endpoints.filter((e) =>
        ['/api/alerts', '/api/notifications'].includes(e.path)
      ),
    },
    {
      name: '报告与反馈',
      endpoints: endpoints.filter((e) =>
        ['/api/export-report', '/api/feedback'].includes(e.path)
      ),
    },
  ];
}
