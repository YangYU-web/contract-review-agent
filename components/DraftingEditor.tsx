'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FilePlus,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Eye,
  Save,
  Send,
  PenLine,
  Variable as VariableIcon,
} from 'lucide-react';
import { DraftedClause, DraftingProject, ClauseVariable } from '@/lib/types';
import { generateContract } from '@/lib/contract-drafting';

// ===== 合同起草编辑器组件 =====
// 左侧项目信息表单 + 中间条款选择与变量填写 + 右侧实时预览 + 底部操作栏
// 组件自行管理状态，不接收 props

// 条款模板类型（与 DraftedClause 一致）
type ClauseTemplate = DraftedClause;

export default function DraftingEditor() {
  // 模板列表
  const [templates, setTemplates] = useState<ClauseTemplate[]>([]);
  // 项目表单字段
  const [name, setName] = useState('新建合同');
  const [contractType, setContractType] = useState('采购合同');
  const [partyA, setPartyA] = useState('北京科技有限公司');
  const [partyB, setPartyB] = useState('');
  // 已添加条款（id 在保存前为模板 id，保存后为服务端 id）
  const [clauses, setClauses] = useState<DraftedClause[]>([]);
  // 变量填充：{ [clauseId]: { [varName]: value } }
  const [variables, setVariables] = useState<
    Record<string, Record<string, string>>
  >({});
  // 已保存的服务端项目 id
  const [projectId, setProjectId] = useState<string | null>(null);
  // 是否有未保存的改动
  const [dirty, setDirty] = useState(false);
  // 生成的合同文本
  const [generatedText, setGeneratedText] = useState<string>('');
  // 状态提示
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>(
    'info'
  );
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // 加载条款模板
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/drafting', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载模板失败');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : '加载模板失败',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // 显示状态提示
  function showStatus(msg: string, type: 'info' | 'success' | 'error' = 'info') {
    setStatusMsg(msg);
    setStatusType(type);
    if (type !== 'error') {
      setTimeout(() => setStatusMsg(null), 3000);
    }
  }

  // 标记为已修改
  function markDirty() {
    setDirty(true);
  }

  // 构建本地项目对象（用于实时预览）
  const previewProject: DraftingProject = useMemo(
    () => ({
      id: projectId || 'preview',
      name,
      contract_type: contractType,
      party_a: partyA,
      party_b: partyB,
      clauses,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    [projectId, name, contractType, partyA, partyB, clauses]
  );

  // 实时预览文本
  const previewText = useMemo(() => {
    if (clauses.length === 0) return '';
    return generateContract(previewProject, variables);
  }, [previewProject, variables, clauses.length]);

  // 添加条款到合同
  function handleAddClause(template: ClauseTemplate) {
    // 同类型条款避免重复
    if (
      template.clause_type !== 'custom' &&
      clauses.some((c) => c.clause_type === template.clause_type)
    ) {
      showStatus('该类型条款已添加', 'error');
      return;
    }
    // 复制模板，初始 id 用模板 id（保存后替换为服务端 id）
    const copy: DraftedClause = {
      ...template,
      id: template.id,
    };
    setClauses((prev) => [...prev, copy]);
    // 初始化变量默认值
    setVariables((prev) => {
      const init: Record<string, string> = {};
      for (const v of template.variables) {
        if (v.default_value) init[v.name] = v.default_value;
      }
      return { ...prev, [template.id]: init };
    });
    markDirty();
  }

  // 移除条款
  function handleRemoveClause(idx: number) {
    const removed = clauses[idx];
    setClauses((prev) => prev.filter((_, i) => i !== idx));
    setVariables((prev) => {
      const next = { ...prev };
      delete next[removed.id];
      return next;
    });
    markDirty();
  }

  // 上移 / 下移条款
  function handleMove(idx: number, dir: 'up' | 'down') {
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= clauses.length) return;
    setClauses((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    markDirty();
  }

  // 变量值变更
  function handleVariableChange(clauseId: string, varName: string, value: string) {
    setVariables((prev) => ({
      ...prev,
      [clauseId]: { ...(prev[clauseId] || {}), [varName]: value },
    }));
    markDirty();
  }

  // 持久化项目到服务端（create_project + add_clause × n），可选生成合同
  const persistAndOptionallyGenerate = useCallback(
    async (withGenerate: boolean) => {
      setBusy(true);
      try {
        // 校验必填字段
        if (!name.trim() || !partyA.trim() || !partyB.trim()) {
          showStatus('请填写合同名称、甲方与乙方', 'error');
          setBusy(false);
          return;
        }

        let pid = projectId;
        let serverClauses = clauses;
        let serverVars = variables;

        // 若已保存且无改动，直接复用；否则重新创建项目并添加条款
        if (!pid || dirty) {
          // 1) 创建项目
          const createRes = await fetch('/api/drafting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create_project',
              name: name.trim(),
              contract_type: contractType.trim(),
              party_a: partyA.trim(),
              party_b: partyB.trim(),
            }),
          });
          if (!createRes.ok) throw new Error('创建项目失败');
          const createData = await createRes.json();
          pid = createData.project.id;

          // 2) 逐条添加条款，收集服务端条款（含服务端 id）
          serverClauses = [];
          serverVars = {};
          for (const clause of clauses) {
            const addRes = await fetch('/api/drafting', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add_clause',
                project_id: pid,
                clause_id: clause.id, // 当前为模板 id
              }),
            });
            if (!addRes.ok) throw new Error('添加条款失败');
            const addData = await addRes.json();
            const serverClause: DraftedClause = addData.clause;
            serverClauses.push(serverClause);
            // 按条款类型把旧变量映射到新 id（非 custom 类型在项目内唯一）
            const oldVars = variables[clause.id] || {};
            serverVars[serverClause.id] = { ...oldVars };
          }

          // 同步本地状态到服务端 id 空间
          setProjectId(pid);
          setClauses(serverClauses);
          setVariables(serverVars);
          setDirty(false);
        }

        // 3) 生成合同文本（可选）
        if (withGenerate) {
          const genRes = await fetch('/api/drafting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'generate',
              project_id: pid,
              variables: serverVars,
            }),
          });
          if (!genRes.ok) throw new Error('生成合同失败');
          const genData = await genRes.json();
          setGeneratedText(genData.contract_text || '');
          showStatus('合同已生成', 'success');
        } else {
          showStatus('草稿已保存', 'success');
        }
      } catch (err) {
        showStatus(
          err instanceof Error ? err.message : '操作失败',
          'error'
        );
      } finally {
        setBusy(false);
      }
    },
    [projectId, dirty, name, contractType, partyA, partyB, clauses, variables]
  );

  // 渲染单个变量输入控件
  function renderVariableInput(
    clauseId: string,
    v: ClauseVariable
  ) {
    const value = variables[clauseId]?.[v.name] ?? v.default_value ?? '';
    const baseCls =
      'w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400';

    if (v.type === 'select' && v.options && v.options.length > 0) {
      return (
        <select
          value={value}
          onChange={(e) =>
            handleVariableChange(clauseId, v.name, e.target.value)
          }
          className={baseCls}
        >
          {v.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    const inputType =
      v.type === 'date'
        ? 'date'
        : v.type === 'number'
        ? 'number'
        : 'text';

    return (
      <input
        type={inputType}
        value={value}
        onChange={(e) =>
          handleVariableChange(clauseId, v.name, e.target.value)
        }
        placeholder={v.label}
        className={baseCls}
      />
    );
  }

  const statusCls =
    statusType === 'success'
      ? 'bg-green-50 text-green-600 border-green-100'
      : statusType === 'error'
      ? 'bg-red-50 text-red-600 border-red-100'
      : 'bg-brand-50 text-brand-600 border-brand-100';

  return (
    <div className="space-y-4">
      {/* 状态提示 */}
      {statusMsg && (
        <div
          className={`px-3 py-2 rounded-lg border text-xs ${statusCls}`}
        >
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 左侧：项目信息表单 */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <FilePlus className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                项目信息
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  合同名称
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    markDirty();
                  }}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                  placeholder="请输入合同名称"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  合同类型
                </label>
                <input
                  type="text"
                  value={contractType}
                  onChange={(e) => {
                    setContractType(e.target.value);
                    markDirty();
                  }}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                  placeholder="如：采购合同"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  甲方
                </label>
                <input
                  type="text"
                  value={partyA}
                  onChange={(e) => {
                    setPartyA(e.target.value);
                    markDirty();
                  }}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                  placeholder="甲方名称"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  乙方
                </label>
                <input
                  type="text"
                  value={partyB}
                  onChange={(e) => {
                    setPartyB(e.target.value);
                    markDirty();
                  }}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                  placeholder="乙方名称"
                />
              </div>
            </div>

            {/* 项目状态摘要 */}
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>已添加条款</span>
                <span className="text-slate-600 font-medium">
                  {clauses.length} 条
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>保存状态</span>
                <span
                  className={`font-medium ${
                    projectId && !dirty
                      ? 'text-green-600'
                      : dirty
                      ? 'text-amber-600'
                      : 'text-slate-500'
                  }`}
                >
                  {projectId && !dirty
                    ? '已保存'
                    : dirty
                    ? '未保存'
                    : '新建'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 中间：条款选择区 + 已添加条款 */}
        <div className="lg:col-span-5 space-y-4">
          {/* 条款模板卡片网格 */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                条款模板
              </h3>
              <span className="text-xs text-slate-400">
                · 点击添加到合同
              </span>
            </div>
            {loading ? (
              <div className="py-6 text-center text-xs text-slate-400">
                加载模板中...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {templates.map((tpl) => {
                  const added = clauses.some(
                    (c) =>
                      c.clause_type === tpl.clause_type &&
                      tpl.clause_type !== 'custom'
                  );
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => handleAddClause(tpl)}
                      disabled={added}
                      className={`text-left p-2.5 rounded-lg border text-xs transition-colors ${
                        added
                          ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                          : 'bg-white border-slate-200 hover:border-brand-300 hover:bg-brand-50/40 text-slate-600'
                      }`}
                    >
                      <div className="font-medium text-slate-700 truncate">
                        {tpl.title}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {tpl.variables.length} 个变量
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 已添加条款列表（可排序、可填写变量） */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <PenLine className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                已添加条款
              </h3>
              <span className="text-xs text-slate-400">
                · 可上下移动排序
              </span>
            </div>
            {clauses.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                暂未添加条款，请从上方模板中选择
              </div>
            ) : (
              <div className="space-y-3">
                {clauses.map((clause, idx) => (
                  <div
                    key={clause.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-50 text-brand-600 text-[11px] font-medium shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-medium text-slate-700 truncate">
                          {clause.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMove(idx, 'up')}
                          disabled={idx === 0}
                          title="上移"
                          className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMove(idx, 'down')}
                          disabled={idx === clauses.length - 1}
                          title="下移"
                          className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveClause(idx)}
                          title="移除"
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* 变量输入区 */}
                    {clause.variables.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {clause.variables.map((v) => (
                          <div key={v.name}>
                            <label className="flex items-center gap-1 text-[11px] text-slate-500 mb-0.5">
                              <VariableIcon className="w-3 h-3 text-slate-400" />
                              {v.label}
                              {v.required && (
                                <span className="text-red-400">*</span>
                              )}
                            </label>
                            {renderVariableInput(clause.id, v)}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 风险提示 */}
                    {clause.risk_notes.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <div className="text-[10px] text-amber-600 mb-0.5">
                          风险提示
                        </div>
                        <ul className="text-[10px] text-slate-400 list-disc pl-4 space-y-0.5">
                          {clause.risk_notes.slice(0, 2).map((note, i) => (
                            <li key={i}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：合同预览 */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-semibold text-slate-800">
                  合同预览
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">实时更新</span>
            </div>
            <div className="max-h-[560px] overflow-y-auto rounded-lg bg-slate-50 border border-slate-100 p-3">
              {clauses.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  添加条款后将显示合同预览
                </div>
              ) : generatedText ? (
                <pre className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap font-mono">
                  {generatedText}
                </pre>
              ) : (
                <pre className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap font-mono">
                  {previewText}
                </pre>
              )}
            </div>
            {/* 变量填写进度 */}
            {clauses.length > 0 && (
              <div className="mt-3 text-[11px] text-slate-400">
                已填写变量：
                <span className="text-slate-600 font-medium">
                  {Object.values(variables).reduce(
                    (sum, vars) =>
                      sum +
                      Object.values(vars).filter(
                        (v) => v && v.trim() !== ''
                      ).length,
                    0
                  )}
                </span>{' '}
                /{' '}
                {clauses.reduce((sum, c) => sum + c.variables.length, 0)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-slate-400">
          {clauses.length > 0
            ? `当前合同包含 ${clauses.length} 个条款`
            : '请添加条款后再生成合同'}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => persistAndOptionallyGenerate(false)}
            disabled={busy || clauses.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" />
            {busy ? '处理中...' : '保存草稿'}
          </button>
          <button
            onClick={() => persistAndOptionallyGenerate(true)}
            disabled={busy || clauses.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 border border-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FilePlus className="w-3.5 h-3.5" />
            {busy ? '处理中...' : '生成合同'}
          </button>
          <button
            onClick={() => showStatus('合同已就绪，可前往上传审查（演示）', 'info')}
            disabled={clauses.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            开始审查
          </button>
        </div>
      </div>
    </div>
  );
}
