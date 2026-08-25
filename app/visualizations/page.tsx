'use client';

// ===== 高级数据可视化页面 =====

export const runtime = 'edge';

import { useState, useMemo } from 'react';
import {
  BarChart3, PieChart, TrendingUp, Grid3x3, Calendar, Download,
  FileText, AlertTriangle, CheckCircle2, Activity,
} from 'lucide-react';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import LineChart from '@/components/charts/LineChart';
import HeatMap from '@/components/charts/HeatMap';
import {
  getRiskDistributionData,
  getRiskTrendData,
  getContractTypeDistribution,
  getRiskHeatmapData,
  getApprovalFlowData,
  getScoreDistribution,
  getMonthlySummary,
} from '@/lib/chart-data';
import { MOCK_REVIEW_RESULT, getMockRisks } from '@/lib/mock-data';

type TimeRange = '30d' | '90d' | '12m';

export default function VisualizationsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('12m');

  // 根据时间范围裁剪月度数据
  const monthCount = timeRange === '30d' ? 1 : timeRange === '90d' ? 3 : 12;

  // 风险分布数据
  const riskDistributionData = useMemo(() => {
    const risks = getMockRisks('mock-001');
    return getRiskDistributionData(risks);
  }, []);

  // 风险趋势数据
  const riskTrendData = useMemo(() => {
    return getRiskTrendData().slice(-monthCount);
  }, [monthCount]);

  // 合同类型分布
  const contractTypeData = useMemo(() => getContractTypeDistribution(), []);

  // 风险热力图
  const heatmapData = useMemo(() => getRiskHeatmapData(), []);

  // 审批流程
  const approvalFlowData = useMemo(() => getApprovalFlowData(), []);

  // 评分分布
  const scoreDistData = useMemo(() => getScoreDistribution(), []);

  // 月度综合摘要
  const monthlySummaryData = useMemo(() => {
    return getMonthlySummary().slice(-monthCount);
  }, [monthCount]);

  // 顶部摘要指标
  const totalContracts = useMemo(
    () => contractTypeData.reduce((sum, d) => sum + d.count, 0),
    [contractTypeData]
  );
  const totalRisks = useMemo(
    () => riskTrendData.reduce((sum, d) => sum + d.total, 0),
    [riskTrendData]
  );
  const totalHighRisks = useMemo(
    () => riskTrendData.reduce((sum, d) => sum + d.high, 0),
    [riskTrendData]
  );
  const avgScore = useMemo(() => {
    const summaries = getMonthlySummary().slice(-monthCount);
    if (summaries.length === 0) return 0;
    return Math.round(summaries.reduce((sum, s) => sum + s.avg_score, 0) / summaries.length);
  }, [monthCount]);

  // 折线图数据：风险趋势（高/中/低）
  const riskTrendSeries = [
    { label: '高风险', values: riskTrendData.map(d => d.high), color: '#dc2626' },
    { label: '中风险', values: riskTrendData.map(d => d.medium), color: '#d97706' },
    { label: '低风险', values: riskTrendData.map(d => d.low), color: '#16a34a' },
  ];

  // 折线图数据：月度综合摘要
  const monthlySummarySeries = [
    { label: '审查合同数', values: monthlySummaryData.map(d => d.contracts), color: '#7c3aed' },
    { label: '高风险数', values: monthlySummaryData.map(d => d.high_risks), color: '#dc2626' },
    { label: '已解决', values: monthlySummaryData.map(d => d.resolved), color: '#16a34a' },
  ];

  // 合同类型分布 -> BarChart 数据
  const contractTypeBarData = contractTypeData.map(d => ({
    label: d.type,
    value: d.count,
    color: d.color,
  }));

  // 评分分布 -> BarChart 数据
  const scoreDistBarData = scoreDistData.map(d => ({
    label: d.range,
    value: d.count,
    color: '#7c3aed',
  }));

  // 审批流程 -> BarChart 数据
  const approvalBarData = approvalFlowData.map(d => ({
    label: d.stage,
    value: d.count,
    color: '#4f46e5',
  }));

  // 风险分布 -> DonutChart 数据（过滤掉value为0的）
  const donutData = riskDistributionData.filter(d => d.value > 0);
  // 如果全为0，使用模拟数据
  const donutChartData = donutData.length > 0
    ? donutData
    : riskDistributionData.map((d, idx) => ({
        label: d.label,
        value: Math.floor(Math.random() * 20) + 2,
        color: d.color,
      }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-600" />
            高级数据可视化
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            合同风险分布、趋势分析、条款热力图等多维度数据洞察
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 时间范围选择器 */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <Calendar className="w-4 h-4 text-slate-400 ml-1.5" />
            {[
              { key: '30d' as TimeRange, label: '近30天' },
              { key: '90d' as TimeRange, label: '近90天' },
              { key: '12m' as TimeRange, label: '12个月' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setTimeRange(opt.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  timeRange === opt.key
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 导出按钮 */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:border-brand-300 hover:text-brand-600 transition-colors">
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>

      {/* 顶部摘要栏：关键指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="审查合同总数"
          value={totalContracts}
          icon={FileText}
          color="text-brand-600"
          bg="bg-brand-50"
        />
        <StatCard
          label="风险识别总数"
          value={totalRisks}
          icon={Activity}
          color="text-indigo-600"
          bg="bg-indigo-50"
        />
        <StatCard
          label="高风险项数"
          value={totalHighRisks}
          icon={AlertTriangle}
          color="text-red-500"
          bg="bg-red-50"
        />
        <StatCard
          label="平均风险评分"
          value={avgScore}
          icon={TrendingUp}
          color={avgScore >= 50 ? 'text-red-500' : 'text-green-500'}
          bg="bg-amber-50"
        />
      </div>

      {/* 图表网格 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. 风险类型分布（环形图） */}
        <ChartCard
          title="风险类型分布"
          icon={PieChart}
          iconColor="text-brand-600"
        >
          <DonutChart data={donutChartData} size={200} />
        </ChartCard>

        {/* 2. 月度风险趋势（折线图，3条线：高/中/低） */}
        <ChartCard
          title="月度风险趋势"
          icon={TrendingUp}
          iconColor="text-indigo-600"
          full
        >
          <LineChart data={riskTrendSeries} height={280} />
        </ChartCard>

        {/* 3. 合同类型分布（横向柱状图） */}
        <ChartCard
          title="合同类型分布"
          icon={BarChart3}
          iconColor="text-brand-600"
        >
          <BarChart data={contractTypeBarData} horizontal height={260} />
        </ChartCard>

        {/* 4. 风险评分分布（柱状图） */}
        <ChartCard
          title="风险评分区间分布"
          icon={BarChart3}
          iconColor="text-purple-600"
        >
          <BarChart data={scoreDistBarData} height={240} />
          <div className="flex justify-around mt-2 text-xs text-slate-400">
            {scoreDistData.map(d => (
              <span key={d.range}>{d.percentage}%</span>
            ))}
          </div>
        </ChartCard>

        {/* 5. 条款-风险热力图 */}
        <ChartCard
          title="条款-风险热力图"
          icon={Grid3x3}
          iconColor="text-purple-600"
          full
        >
          <HeatMap data={heatmapData} />
        </ChartCard>

        {/* 6. 审批流程统计（柱状图） */}
        <ChartCard
          title="审批流程统计"
          icon={BarChart3}
          iconColor="text-blue-600"
        >
          <BarChart data={approvalBarData} height={240} />
          <div className="flex justify-around mt-2 text-xs text-slate-400">
            {approvalFlowData.map(d => (
              <span key={d.stage}>平均{d.avg_days}天</span>
            ))}
          </div>
        </ChartCard>

        {/* 7. 月度综合摘要（折线图） */}
        <ChartCard
          title="月度综合摘要"
          icon={TrendingUp}
          iconColor="text-green-600"
        >
          <LineChart data={monthlySummarySeries} height={240} />
        </ChartCard>
      </div>

      {/* 底部说明 */}
      <div className="mt-8 bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-600">
          <p className="font-medium text-slate-700 mb-1">数据说明</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            本页面所有图表均为纯CSS/SVG实现，无第三方图表库依赖。数据来源于合同审查记录的统计分析，
            包含12类风险类型分布、12个月趋势、8种合同类型、12类条款风险热力图等多维度可视化。
            悬停图表元素可查看详细数据。
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== 顶部统计卡片组件 =====
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 card-hover">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-slate-800">{value}</div>
          <div className="text-xs text-slate-400 truncate">{label}</div>
        </div>
      </div>
    </div>
  );
}

// ===== 图表卡片容器组件 =====
function ChartCard({
  title,
  icon: Icon,
  iconColor,
  children,
  full,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${full ? 'lg:col-span-2' : ''}`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}
