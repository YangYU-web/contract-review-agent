// ===== 合同风险模拟 API =====
// 提供模拟列表与统计查询，以及基于参数运行新模拟
// 优先使用 Supabase 数据库（risk_simulations 表）持久化模拟结果，数据库未配置或操作失败时优雅降级到内存 Mock 数据。
// 蒙特卡洛模拟算法逻辑保持不变（复用 lib/risk-simulation 的 runSimulation）。

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { RiskSimulation, SimulationScenario } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  getMockRiskSimulations,
  getSimulationStats,
  runSimulation,
} from '@/lib/risk-simulation';

// 模块级内存存储（仅作降级兜底）：初始化为 Mock 数据
let simulationsStore: RiskSimulation[] = getMockRiskSimulations();

// 获取 Supabase 服务端客户端（如未配置返回 null）
async function getDb() {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseServer } = await import('@/lib/supabase');
  return getSupabaseServer();
}

// 判断字符串是否为合法 UUID
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// 从数据库读取模拟列表
async function fetchSimulationsFromDb(supabase: any): Promise<RiskSimulation[]> {
  const { data, error } = await supabase
    .from('risk_simulations')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as RiskSimulation[];
}

// GET: 返回模拟列表与统计
export async function GET() {
  try {
    // 优先尝试数据库
    const supabase = await getDb();
    if (supabase) {
      try {
        const simulations = await fetchSimulationsFromDb(supabase);
        const stats = getSimulationStats(simulations);
        return NextResponse.json({
          simulations,
          stats,
          mock: false,
        });
      } catch (dbErr) {
        console.error('Risk simulation GET DB error, falling back to mock:', dbErr);
      }
    }

    // 降级：内存 Mock 数据
    const stats = getSimulationStats(simulationsStore);
    return NextResponse.json({
      simulations: simulationsStore,
      stats,
      mock: true,
    });
  } catch (err) {
    console.error('Risk simulation GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 接收 { contract_id, contract_title, scenario, iterations } 运行新模拟
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contract_id,
      contract_title,
      scenario,
      iterations,
    } = body as {
      contract_id: string;
      contract_title: string;
      scenario: SimulationScenario;
      iterations: number;
    };

    if (!contract_id || !contract_title) {
      return NextResponse.json(
        { error: '缺少 contract_id 或 contract_title 参数' },
        { status: 400 }
      );
    }

    const validScenarios: SimulationScenario[] = [
      'best_case',
      'base_case',
      'worst_case',
      'stress_test',
      'monte_carlo',
    ];
    const simScenario: SimulationScenario = validScenarios.includes(scenario)
      ? scenario
      : 'monte_carlo';

    // 迭代次数限制（1000 - 20000，演示模式下限 1000）
    const iter = Math.max(1000, Math.min(20000, Number(iterations) || 1000));

    // 保留蒙特卡洛模拟算法逻辑
    const simulation = runSimulation(
      contract_id,
      contract_title,
      simScenario,
      iter
    );

    // 尝试持久化到数据库
    const supabase = await getDb();
    if (supabase) {
      try {
        const insertPayload: any = {
          contract_title: simulation.contract_title,
          scenario: simulation.scenario,
          iterations: simulation.iterations,
          summary: simulation.summary,
          risk_factors: simulation.risk_factors,
          scenario_results: simulation.scenario_results,
          distribution: simulation.distribution,
          var_analysis: simulation.var_analysis,
          recommendations: simulation.recommendations || [],
          generated_at: simulation.generated_at,
        };
        // 仅当 contract_id 为合法 UUID 时才写入外键，否则置空避免外键报错
        if (isUuid(contract_id)) {
          insertPayload.contract_id = contract_id;
        }
        const { data, error } = await supabase
          .from('risk_simulations')
          .insert(insertPayload)
          .select()
          .single();
        if (error) throw error;
        const persisted = { ...simulation, ...(data as any) } as RiskSimulation;
        const allSimulations = await fetchSimulationsFromDb(supabase);
        return NextResponse.json({
          simulation: persisted,
          simulations: allSimulations,
          stats: getSimulationStats(allSimulations),
          mock: false,
        });
      } catch (dbErr) {
        console.error('Risk simulation POST DB error, falling back to mock:', dbErr);
      }
    }

    // 降级：内存存储（保留最近 50 条）
    simulationsStore = [simulation, ...simulationsStore].slice(0, 50);

    return NextResponse.json({
      simulation,
      simulations: simulationsStore,
      stats: getSimulationStats(simulationsStore),
      mock: true,
    });
  } catch (err) {
    console.error('Risk simulation POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
