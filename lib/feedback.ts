// ===== 用户反馈收集系统 =====
// 收集用户对AI审查建议的评分和反馈，用于持续改进

import { ContractRisk } from './types';

export type FeedbackRating = 'helpful' | 'not_helpful' | 'partially_helpful';

export interface RiskFeedback {
  id: string;
  risk_id: string;
  contract_id: string;
  rating: FeedbackRating;
  comment?: string;
  user_email?: string;
  created_at: string;
}

export interface FeedbackStats {
  total_feedback: number;
  helpful_count: number;
  partially_count: number;
  not_helpful_count: number;
  helpful_rate: number;
  recent_comments: { risk_id: string; comment: string; rating: FeedbackRating; created_at: string }[];
}

// Mock反馈数据
const MOCK_FEEDBACK: RiskFeedback[] = [
  {
    id: 'fb-001',
    risk_id: 'mock-risk-0',
    contract_id: 'mock-001',
    rating: 'helpful',
    comment: '预付款50%确实太高了，修改建议很实用',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'fb-002',
    risk_id: 'mock-risk-1',
    contract_id: 'mock-001',
    rating: 'helpful',
    comment: '违约金条款修改后清晰多了',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'fb-003',
    risk_id: 'mock-risk-2',
    contract_id: 'mock-001',
    rating: 'partially_helpful',
    comment: '修改方向对，但实际操作中需要更灵活的归属方案',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'fb-004',
    risk_id: 'mock-risk-4',
    contract_id: 'mock-002',
    rating: 'helpful',
    comment: '交付周期30天更合理，加上逾期违约条款很有必要',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'fb-005',
    risk_id: 'mock-risk-3',
    contract_id: 'mock-002',
    rating: 'not_helpful',
    comment: '管辖法院建议改为乙方所在地，因为我们是乙方',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

// 保存反馈
export async function saveFeedback(feedback: Omit<RiskFeedback, 'id' | 'created_at'>): Promise<RiskFeedback> {
  const newFeedback: RiskFeedback = {
    ...feedback,
    id: `fb-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    // 浏览器端：存储到localStorage
    const existing = JSON.parse(localStorage.getItem('risk_feedbacks') || '[]');
    // 替换同一风险的旧反馈
    const filtered = existing.filter((f: RiskFeedback) => f.risk_id !== feedback.risk_id);
    filtered.push(newFeedback);
    localStorage.setItem('risk_feedbacks', JSON.stringify(filtered));
  }

  return newFeedback;
}

// 获取某个风险的反馈
export function getRiskFeedback(riskId: string): RiskFeedback | null {
  if (typeof window !== 'undefined') {
    const feedbacks = JSON.parse(localStorage.getItem('risk_feedbacks') || '[]');
    return feedbacks.find((f: RiskFeedback) => f.risk_id === riskId) || null;
  }
  return MOCK_FEEDBACK.find(f => f.risk_id === riskId) || null;
}

// 获取所有反馈统计
export function getFeedbackStats(): FeedbackStats {
  let feedbacks: RiskFeedback[] = [];

  if (typeof window !== 'undefined') {
    feedbacks = JSON.parse(localStorage.getItem('risk_feedbacks') || '[]');
  }

  // 合并Mock数据
  feedbacks = [...feedbacks, ...MOCK_FEEDBACK];

  const total = feedbacks.length;
  const helpful = feedbacks.filter(f => f.rating === 'helpful').length;
  const partially = feedbacks.filter(f => f.rating === 'partially_helpful').length;
  const notHelpful = feedbacks.filter(f => f.rating === 'not_helpful').length;

  const recentComments = feedbacks
    .filter(f => f.comment)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map(f => ({
      risk_id: f.risk_id,
      comment: f.comment!,
      rating: f.rating,
      created_at: f.created_at,
    }));

  return {
    total_feedback: total,
    helpful_count: helpful,
    partially_count: partially,
    not_helpful_count: notHelpful,
    helpful_rate: total > 0 ? Math.round((helpful / total) * 100) : 0,
    recent_comments: recentComments,
  };
}

// 反馈评分标签
export const FEEDBACK_RATING_LABELS: Record<FeedbackRating, { label: string; color: string; icon: string }> = {
  helpful: { label: '有帮助', color: '#16a34a', icon: 'thumbs-up' },
  partially_helpful: { label: '部分有帮助', color: '#d97706', icon: 'meh' },
  not_helpful: { label: '没有帮助', color: '#dc2626', icon: 'thumbs-down' },
};
