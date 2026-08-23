'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Meh, MessageSquare, Check } from 'lucide-react';
import { saveFeedback, getRiskFeedback, RiskFeedback, FeedbackRating, FEEDBACK_RATING_LABELS } from '@/lib/feedback';

interface FeedbackWidgetProps {
  riskId: string;
  contractId: string;
}

export default function FeedbackWidget({ riskId, contractId }: FeedbackWidgetProps) {
  const [feedback, setFeedback] = useState<RiskFeedback | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const existing = getRiskFeedback(riskId);
    if (existing) {
      setFeedback(existing);
      setComment(existing.comment || '');
    }
  }, [riskId]);

  const handleRate = async (rating: FeedbackRating) => {
    const newFeedback = await saveFeedback({
      risk_id: riskId,
      contract_id: contractId,
      rating,
      comment: comment || undefined,
    });
    setFeedback(newFeedback);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const handleCommentSubmit = async () => {
    if (!feedback) return;
    const updated = await saveFeedback({
      ...feedback,
      comment,
    });
    setFeedback(updated);
    setShowComment(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const buttons: { rating: FeedbackRating; icon: React.ElementType; label: string }[] = [
    { rating: 'helpful', icon: ThumbsUp, label: '有帮助' },
    { rating: 'partially_helpful', icon: Meh, label: '部分' },
    { rating: 'not_helpful', icon: ThumbsDown, label: '没帮助' },
  ];

  return (
    <div className="border-t border-slate-100 pt-3 mt-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 mr-1">AI建议是否有帮助？</span>
        {buttons.map(btn => {
          const Icon = btn.icon;
          const isActive = feedback?.rating === btn.rating;
          const config = FEEDBACK_RATING_LABELS[btn.rating];
          return (
            <button
              key={btn.rating}
              onClick={() => handleRate(btn.rating)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'text-white'
                  : 'text-slate-400 bg-slate-50 hover:bg-slate-100'
              }`}
              style={isActive ? { backgroundColor: config.color } : {}}
            >
              <Icon className="w-3.5 h-3.5" />
              {btn.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowComment(!showComment)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 bg-slate-50 hover:bg-slate-100"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {feedback?.comment ? '已留言' : '留言'}
        </button>
        {submitted && (
          <span className="text-xs text-green-600 flex items-center gap-0.5">
            <Check className="w-3 h-3" /> 已记录
          </span>
        )}
      </div>

      {showComment && (
        <div className="mt-2 flex items-start gap-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="补充你的反馈意见（可选）"
            className="flex-1 text-xs p-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-brand-300"
            rows={2}
          />
          <button
            onClick={handleCommentSubmit}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-600 hover:bg-brand-700"
          >
            提交
          </button>
        </div>
      )}
    </div>
  );
}
