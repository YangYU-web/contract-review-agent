// ===== 审批流 API =====
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createApprovalFlow, advanceApprovalFlow, getMockApprovalFlow } from '@/lib/approval-flow';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Contract } from '@/lib/types';

// 创建审批流
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, contractId, riskScore, highRiskCount, decision, approverName, comment, flow } = body;

    if (action === 'create') {
      // 创建审批流
      let flow;
      if (isSupabaseConfigured()) {
        try {
          const { getSupabaseServer } = await import('@/lib/supabase');
          const supabase = getSupabaseServer();
          if (supabase) {
            const { data: contract } = await supabase
              .from('contracts').select('*').eq('id', contractId).single();
            if (contract) {
              flow = createApprovalFlow(contract as Contract);
              // 保存到数据库
              await supabase.from('approval_flows').insert({
                contract_id: contractId,
                current_node: flow.current_node,
                status: flow.status,
                route_reason: flow.route_reason,
                auto_approved: flow.auto_approved,
                completed_at: flow.completed_at,
              });
              for (const node of flow.nodes) {
                await supabase.from('approval_nodes').insert({
                  flow_id: flow.id,
                  contract_id: contractId,
                  node_order: node.order,
                  role: node.role,
                  status: node.status,
                  approver_name: node.approver_name,
                  comment: node.comment,
                  completed_at: node.completed_at,
                });
              }
            }
          }
        } catch {
          flow = getMockApprovalFlow(contractId, riskScore || 50, highRiskCount || 1);
        }
      } else {
        flow = getMockApprovalFlow(contractId, riskScore || 50, highRiskCount || 1);
      }

      return NextResponse.json(flow);
    }

    if (action === 'advance') {
      // 推进审批流
      if (!flow || !decision) {
        return NextResponse.json({ error: '缺少 flow 或 decision 参数' }, { status: 400 });
      }

      const updatedFlow = advanceApprovalFlow(flow, decision, approverName || '审批人', comment);

      // 保存到数据库
      if (isSupabaseConfigured()) {
        try {
          const { getSupabaseServer } = await import('@/lib/supabase');
          const supabase = getSupabaseServer();
          if (supabase) {
            const currentNode = updatedFlow.nodes[updatedFlow.current_node];
              await supabase.from('approval_nodes')
              .update({
                status: decision,
                approver_name: approverName,
                comment: comment,
                completed_at: new Date().toISOString(),
              })
              .eq('flow_id', flow.id)
              .eq('node_order', currentNode?.order);

            await supabase.from('approval_flows')
              .update({
                current_node: updatedFlow.current_node,
                status: updatedFlow.status,
                completed_at: updatedFlow.completed_at,
              })
              .eq('id', flow.id);
          }
        } catch (dbErr) {
          console.error('DB update failed:', dbErr);
        }
      }

      return NextResponse.json(updatedFlow);
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (err) {
    console.error('Approval API error:', err);
    return NextResponse.json({
      error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}`
    }, { status: 500 });
  }
}
