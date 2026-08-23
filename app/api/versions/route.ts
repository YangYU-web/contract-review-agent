// ===== 合同版本管理 API =====
// 提供版本列表查询与版本创建能力
// 数据存储：Supabase contract_versions 表，失败时降级为 Mock 数据

import { NextRequest, NextResponse } from 'next/server';
import { ContractVersion, VersionChange } from '@/lib/types';
import {
  getMockVersions,
  createVersionSnapshot,
  compareVersions,
} from '@/lib/contract-versions';

// 将数据库行映射为 ContractVersion 类型
function mapRow(row: any): ContractVersion {
  return {
    id: row.id,
    contract_id: row.contract_id,
    version_number: row.version_number,
    version_label: row.version_label,
    content: row.content,
    change_summary: row.change_summary || '',
    changes: Array.isArray(row.changes) ? row.changes : [],
    created_by: row.created_by || 'system',
    created_at: row.created_at,
  };
}

// 计算统计信息
function getStats(list: ContractVersion[]) {
  const sorted = [...list].sort(
    (a, b) => b.version_number - a.version_number
  );
  return {
    total: list.length,
    latest_version: list.length > 0 ? sorted[0].version_label : '-',
    latest_date: list.length > 0 ? sorted[0].created_at : null,
    total_changes: list.reduce((sum, v) => sum + v.changes.length, 0),
  };
}

// 生成变更摘要（与 createVersionSnapshot 中的逻辑一致）
function buildChangeSummary(label: string, changes: VersionChange[]): string {
  const changeCount = changes.length;
  const modifiedCount = changes.filter((c) => c.change_type === 'modified').length;
  const addedCount = changes.filter((c) => c.change_type === 'added').length;
  const removedCount = changes.filter((c) => c.change_type === 'removed').length;

  return changeCount === 0
    ? `新建版本 ${label}，暂无变更记录。`
    : `新建版本 ${label}，共 ${changeCount} 处变更（修改 ${modifiedCount}、新增 ${addedCount}、删除 ${removedCount}）。`;
}

// GET: 接收 contract_id 查询参数，返回版本列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contract_id');

    if (!contractId) {
      return NextResponse.json(
        { error: '缺少 contract_id 查询参数' },
        { status: 400 }
      );
    }

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const { data, error } = await supabase
          .from('contract_versions')
          .select('*')
          .eq('contract_id', contractId)
          .order('version_number', { ascending: false });

        if (error) throw error;

        const list: ContractVersion[] = (data || []).map(mapRow);
        const stats = getStats(list);

        return NextResponse.json({
          versions: list,
          stats,
          mock: false,
        });
      }
    } catch (dbErr) {
      console.error('Versions DB query failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    const list = getMockVersions(contractId);
    const sorted = [...list].sort(
      (a, b) => b.version_number - a.version_number
    );
    const stats = getStats(list);

    return NextResponse.json({
      versions: sorted,
      stats,
      mock: true,
    });
  } catch (err) {
    console.error('Versions GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 接收 { contract_id, content, label, changes? } 创建新版本
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contract_id, content, label, changes } = body;

    // 参数校验
    if (!contract_id) {
      return NextResponse.json(
        { error: '缺少 contract_id 参数' },
        { status: 400 }
      );
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: '缺少 content 参数或内容为空' },
        { status: 400 }
      );
    }
    if (!label) {
      return NextResponse.json(
        { error: '缺少 label 参数' },
        { status: 400 }
      );
    }

    const inputChanges: VersionChange[] = Array.isArray(changes) ? changes : [];

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        // 查询现有版本以确定下一个版本号
        const { data: existing, error: existError } = await supabase
          .from('contract_versions')
          .select('version_number, version_label, content, change_summary, changes, created_at, id, contract_id')
          .eq('contract_id', contract_id)
          .order('version_number', { ascending: false });

        if (existError) throw existError;

        const existingList: ContractVersion[] = (existing || []).map(mapRow);
        const nextNumber =
          existingList.length > 0
            ? Math.max(...existingList.map((v) => v.version_number)) + 1
            : 1;

        let finalChanges = inputChanges;
        let changeSummary = buildChangeSummary(label, inputChanges);

        // 若未传入变更，则与上一版本自动对比生成变更
        if (inputChanges.length === 0 && existingList.length > 0) {
          const prev = existingList[0]; // 已按 version_number 倒序，第一条为最新
          const snapshot: ContractVersion = {
            id: '',
            contract_id,
            version_number: nextNumber,
            version_label: label,
            content,
            change_summary: changeSummary,
            changes: [],
            created_by: 'system',
            created_at: new Date().toISOString(),
          };
          finalChanges = compareVersions(prev, snapshot);
          changeSummary =
            finalChanges.length === 0
              ? changeSummary
              : `基于上一版本 ${prev.version_label} 自动对比，共 ${finalChanges.length} 处变更。`;
        }

        const insertData: Record<string, any> = {
          contract_id,
          version_number: nextNumber,
          version_label: label,
          content,
          change_summary: changeSummary,
          changes: finalChanges,
          // created_by 省略（未启用认证）
        };

        const { data, error } = await supabase
          .from('contract_versions')
          .insert(insertData)
          .select('*')
          .single();

        if (error) throw error;

        const snapshot = mapRow(data);

        // 查询全量列表用于返回
        const { data: allData, error: allError } = await supabase
          .from('contract_versions')
          .select('*')
          .eq('contract_id', contract_id)
          .order('version_number', { ascending: false });

        if (allError) throw allError;

        const allList: ContractVersion[] = (allData || []).map(mapRow);
        const stats = getStats(allList);

        return NextResponse.json({
          version: snapshot,
          versions: allList,
          stats,
          mock: false,
        });
      }
    } catch (dbErr) {
      console.error('Versions DB insert failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    const mockList = getMockVersions(contract_id);
    const snapshot = createVersionSnapshot(
      content,
      contract_id,
      label,
      inputChanges
    );

    // 若未传入变更，则与上一版本自动对比生成变更
    if (inputChanges.length === 0 && mockList.length > 0) {
      const prev = [...mockList].sort(
        (a, b) => b.version_number - a.version_number
      )[0];
      snapshot.changes = compareVersions(prev, snapshot);
      snapshot.change_summary =
        snapshot.changes.length === 0
          ? snapshot.change_summary
          : `基于上一版本 ${prev.version_label} 自动对比，共 ${snapshot.changes.length} 处变更。`;
    }

    mockList.push(snapshot);

    const sorted = [...mockList].sort(
      (a, b) => b.version_number - a.version_number
    );

    const stats = getStats(mockList);

    return NextResponse.json({
      version: snapshot,
      versions: sorted,
      stats,
      mock: true,
    });
  } catch (err) {
    console.error('Versions POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
