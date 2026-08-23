'use client';

import { FileSignature, Shield, Info } from 'lucide-react';
import SignatureManager from '@/components/SignatureManager';

// ===== 电子签章页面 =====
// 标题区 + SignatureManager 组件 + 底部说明（签章流程 / 法律效力 / 证书说明）

export default function SignaturesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSignature className="w-6 h-6 text-brand-600" />
          电子签章
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          集成可信电子签章能力，支持多签署人顺序 / 并行签署、证书验签与完整审计追踪
        </p>
      </div>

      {/* 签章管理 */}
      <SignatureManager />

      {/* 底部说明 */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 签章流程 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <FileSignature className="w-4 h-4 text-brand-600" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">签章流程</h3>
          </div>
          <ol className="space-y-2 text-xs text-slate-500">
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium shrink-0">
                1
              </span>
              <span>选择关联合同并创建签章请求，系统自动生成文档哈希</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium shrink-0">
                2
              </span>
              <span>CA 中心签发数字证书，绑定签署人身份</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium shrink-0">
                3
              </span>
              <span>签署人按设定的顺序 / 并行方式完成签署</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium shrink-0">
                4
              </span>
              <span>全部签署完成后，生成完整审计报告</span>
            </li>
          </ol>
        </div>

        {/* 法律效力 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">法律效力</h3>
          </div>
          <ul className="space-y-2 text-xs text-slate-500">
            <li className="flex gap-2">
              <span className="text-emerald-500 shrink-0">·</span>
              <span>符合《电子签名法》关于可靠电子签名的规定</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500 shrink-0">·</span>
              <span>与手写签名或盖章具有同等法律效力</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500 shrink-0">·</span>
              <span>支持事后验签与司法举证</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500 shrink-0">·</span>
              <span>签署过程全程留痕，不可篡改</span>
            </li>
          </ul>
        </div>

        {/* 证书说明 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Info className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">证书说明</h3>
          </div>
          <ul className="space-y-2 text-xs text-slate-500">
            <li className="flex gap-2">
              <span className="text-blue-500 shrink-0">·</span>
              <span>采用 CA 机构颁发的 X.509 数字证书</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500 shrink-0">·</span>
              <span>使用 SHA-256 with RSA 签名算法</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500 shrink-0">·</span>
              <span>文档哈希确保签署内容未被篡改</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500 shrink-0">·</span>
              <span>记录签署人 IP 与设备信息以备核验</span>
            </li>
          </ul>
        </div>
      </div>

      {/* 演示模式提示 */}
      <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-400 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>当前为演示模式，签章数据存储于内存中，刷新后将重置；文档哈希与证书信息均为模拟生成，仅供功能预览。</span>
      </div>
    </div>
  );
}
