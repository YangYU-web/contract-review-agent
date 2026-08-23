// ===== 电子签章集成模块 =====
// 提供签章请求的 Mock 数据、创建、签署、拒签、作废与统计能力
// 演示模式：所有签章请求存储在内存中，文档哈希与证书信息均为模拟生成
// 供签章 API 与签章管理组件共用

import {
  SignatureRequest,
  Signer,
  CertificateInfo,
  SignatureAuditEntry,
  SignatureStatus,
  SignerStatus,
  SIGNATURE_STATUS_CONFIG,
  SIGNER_STATUS_CONFIG,
} from './types';

// ===== 工具函数 =====

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// 生成距离今天指定小时之后的 ISO 时间字符串
function hoursAfter(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

// 生成距离今天指定天数之后的 ISO 时间字符串
function daysAfter(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

// 生成随机十六进制字符串（用于哈希 / 序列号等）
function randomHex(length: number): string {
  let result = '';
  const chars = '0123456789abcdef';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// 生成简短唯一 id
function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 模拟 IP 地址生成
function mockIpAddress(): string {
  return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// 模拟设备信息
function mockDeviceInfo(): string {
  const platforms = [
    'Windows 10 / Chrome 120',
    'macOS 14 / Safari 17',
    'iOS 17 / Mobile',
    'Android 14 / Chrome 120',
    'Windows 11 / Edge 120',
  ];
  return platforms[Math.floor(Math.random() * platforms.length)];
}

// ===== 模拟 SHA-256 哈希 =====
// 使用简单散列算法模拟 256 位哈希输出（64 位十六进制字符串）
// 注意：此为演示实现，不用于真实安全场景
export function generateDocumentHash(text: string): string {
  // 简单散列：将字符编码累加并扩散到 64 位十六进制
  let h1 = 0x811c9dc5;
  let h2 = 0x10001373;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x85ebca77);
  }
  // 组合并补齐到 64 位十六进制字符串
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const part3 = randomHex(24);
  const part4 = randomHex(24);
  return (part1 + part2 + part3 + part4).slice(0, 64).padEnd(64, '0');
}

// ===== 模拟 CA 证书信息 =====
// 生成一个模拟的 CA 颁发数字证书，含颁发机构、主题、序列号、有效期与签名算法
export function generateCertificateInfo(): CertificateInfo {
  const issuers = [
    'CFCA 数字证书认证中心',
    '北京数字认证股份有限公司 BJCA',
    '上海市数字证书认证中心 SHECA',
    '深圳市电子证书认证中心',
  ];
  const now = new Date();
  const validFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const validTo = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  return {
    issuer: issuers[Math.floor(Math.random() * issuers.length)],
    subject: `CN=${genId('subject')}, O=Contract Review Agent, C=CN`,
    serial_number: randomHex(16).toUpperCase(),
    valid_from: validFrom.toISOString(),
    valid_to: validTo.toISOString(),
    algorithm: 'SHA-256 with RSA',
  };
}

// ===== 创建审计条目 =====
function createAuditEntry(
  action: string,
  actor: string,
  details: string,
  ip?: string
): SignatureAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    action,
    actor,
    details,
    ip_address: ip,
  };
}

// ===== 判断顺序签署模式下当前可签署的签署人 =====
// sequential 模式下只有上一个签署人完成后，下一个签署人才能签署
function getCurrentSequentialSignerIndex(signers: Signer[]): number {
  for (let i = 0; i < signers.length; i++) {
    if (signers[i].status === 'waiting') return i;
  }
  return -1;
}

// ===== 创建签章请求 =====
// 生成文档哈希、CA 证书信息，初始化签署人与审计追踪
export function createSignatureRequest(
  contractId: string,
  contractTitle: string,
  signers: { name: string; email: string; role: string }[],
  order: 'sequential' | 'parallel' | 'any',
  expiresInDays: number
): SignatureRequest {
  const now = new Date();
  const documentText = `合同编号:${contractId}\n合同标题:${contractTitle}\n签署人:${signers.map((s) => s.name).join(',')}\n创建时间:${now.toISOString()}`;

  const documentHash = generateDocumentHash(documentText);
  const certificateInfo = generateCertificateInfo();

  // 初始化签署人列表
  const initializedSigners: Signer[] = signers.map((s, idx) => ({
    id: genId('signer'),
    name: s.name,
    email: s.email,
    role: s.role,
    status: order === 'sequential' && idx > 0 ? 'waiting' : 'waiting',
    // sequential 模式下首个签署人激活，其余等待；parallel/any 全部激活
  }));

  // 审计追踪初始化
  const auditTrail: SignatureAuditEntry[] = [
    createAuditEntry(
      'request_created',
      '系统',
      `创建签章请求，合同「${contractTitle}」，签署顺序：${order}，签署人 ${signers.length} 名，有效期 ${expiresInDays} 天`,
      mockIpAddress()
    ),
    createAuditEntry(
      'document_hashed',
      '系统',
      `文档哈希生成完成：${documentHash.substring(0, 24)}...`,
      mockIpAddress()
    ),
    createAuditEntry(
      'certificate_issued',
      certificateInfo.issuer,
      `数字证书已签发，序列号：${certificateInfo.serial_number}，有效期至 ${certificateInfo.valid_to.split('T')[0]}`,
      mockIpAddress()
    ),
  ];

  return {
    id: genId('sig'),
    contract_id: contractId,
    contract_title: contractTitle,
    initiators: initializedSigners.slice(0, 1),
    signers: initializedSigners,
    signing_order: order,
    status: 'pending',
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
    document_hash: documentHash,
    certificate_info: certificateInfo,
    audit_trail: auditTrail,
  };
}

// ===== 签署文档 =====
// 更新签署人状态、记录 IP 与设备信息、追加审计条目，并检查是否全部签署完成
export function signDocument(
  requestId: string,
  signerId: string,
  signatureImage?: string
): { success: boolean; request?: SignatureRequest; error?: string } {
  const request = signatureStore.find((r) => r.id === requestId);
  if (!request) {
    return { success: false, error: '签章请求不存在' };
  }
  if (request.status === 'signed') {
    return { success: false, error: '该签章请求已完成签署' };
  }
  if (request.status === 'rejected' || request.status === 'voided' || request.status === 'expired') {
    return { success: false, error: `该签章请求当前状态为「${SIGNATURE_STATUS_CONFIG[request.status].label}」，无法签署` };
  }

  const signer = request.signers.find((s) => s.id === signerId);
  if (!signer) {
    return { success: false, error: '签署人不存在' };
  }
  if (signer.status === 'signed') {
    return { success: false, error: '该签署人已完成签署' };
  }
  if (signer.status === 'rejected') {
    return { success: false, error: '该签署人已拒签' };
  }

  // sequential 模式下检查是否轮到当前签署人
  if (request.signing_order === 'sequential') {
    const currentIdx = getCurrentSequentialSignerIndex(request.signers);
    if (currentIdx < 0 || request.signers[currentIdx].id !== signerId) {
      return { success: false, error: '顺序签署模式下，请等待前一位签署人完成签署' };
    }
  }

  const ip = mockIpAddress();
  const device = mockDeviceInfo();
  const now = new Date().toISOString();

  // 更新签署人状态
  signer.status = 'signed';
  signer.signed_at = now;
  signer.ip_address = ip;
  signer.device_info = device;
  if (signatureImage) {
    signer.signature_image = signatureImage;
  }

  // 追加审计条目
  request.audit_trail.push(
    createAuditEntry(
      'document_signed',
      signer.name,
      `签署人「${signer.name}（${signer.role}）」完成签署，IP：${ip}，设备：${device}`,
      ip
    )
  );

  // 检查是否全部签署完成
  const allSigned = request.signers.every((s) => s.status === 'signed');
  if (allSigned) {
    request.status = 'signed';
    request.completed_at = now;
    request.audit_trail.push(
      createAuditEntry(
        'request_completed',
        '系统',
        `所有签署人已完成签署，签章请求状态更新为「已签」，文档哈希校验通过：${request.document_hash.substring(0, 24)}...`,
        ip
      )
    );
  }

  return { success: true, request };
}

// ===== 拒签 =====
// 更新签署人状态为 rejected，并将整个签章请求标记为 rejected
export function rejectSignature(
  requestId: string,
  signerId: string,
  reason: string
): { success: boolean; request?: SignatureRequest; error?: string } {
  const request = signatureStore.find((r) => r.id === requestId);
  if (!request) {
    return { success: false, error: '签章请求不存在' };
  }
  if (request.status === 'signed') {
    return { success: false, error: '该签章请求已完成签署，无法拒签' };
  }
  if (request.status === 'rejected' || request.status === 'voided' || request.status === 'expired') {
    return { success: false, error: `该签章请求当前状态为「${SIGNATURE_STATUS_CONFIG[request.status].label}」，无法拒签` };
  }

  const signer = request.signers.find((s) => s.id === signerId);
  if (!signer) {
    return { success: false, error: '签署人不存在' };
  }
  if (signer.status === 'signed') {
    return { success: false, error: '该签署人已完成签署，无法拒签' };
  }

  const ip = mockIpAddress();
  const now = new Date().toISOString();

  // 更新签署人状态
  signer.status = 'rejected';
  signer.signed_at = now;
  signer.ip_address = ip;

  // 整个请求标记为拒签
  request.status = 'rejected';
  request.completed_at = now;

  // 追加审计条目
  request.audit_trail.push(
    createAuditEntry(
      'signature_rejected',
      signer.name,
      `签署人「${signer.name}（${signer.role}）」拒签，原因：${reason}，IP：${ip}`,
      ip
    )
  );

  return { success: true, request };
}

// ===== 作废签章请求 =====
export function voidSignatureRequest(requestId: string): { success: boolean; request?: SignatureRequest; error?: string } {
  const request = signatureStore.find((r) => r.id === requestId);
  if (!request) {
    return { success: false, error: '签章请求不存在' };
  }
  if (request.status === 'voided') {
    return { success: false, error: '该签章请求已作废' };
  }

  const now = new Date().toISOString();
  request.status = 'voided';
  request.completed_at = now;
  request.audit_trail.push(
    createAuditEntry(
      'request_voided',
      '系统',
      `签章请求已作废，合同「${request.contract_title}」`,
      mockIpAddress()
    )
  );

  return { success: true, request };
}

// ===== 模拟签章请求数据 =====
// 返回 4 个模拟签章请求，覆盖 pending / signed / rejected 三种状态
export function getMockSignatureRequests(): SignatureRequest[] {
  const now = new Date();

  // ----- 请求 1：已签署完成（顺序签署，2 人）-----
  const req1Signers: Signer[] = [
    {
      id: 'sig-signer-001',
      name: '张法务',
      email: 'zhangfa@company.com',
      role: '甲方代表',
      status: 'signed',
      signed_at: daysAgo(2),
      ip_address: '192.168.1.10',
      device_info: 'Windows 10 / Chrome 120',
      signature_image: 'data:image/png;base64,模拟签名图片1',
    },
    {
      id: 'sig-signer-002',
      name: '李供应商',
      email: 'lisupplier@vendor.com',
      role: '乙方代表',
      status: 'signed',
      signed_at: daysAgo(1),
      ip_address: '192.168.2.45',
      device_info: 'macOS 14 / Safari 17',
      signature_image: 'data:image/png;base64,模拟签名图片2',
    },
  ];
  const req1: SignatureRequest = {
    id: 'sig-001',
    contract_id: 'mock-001',
    contract_title: 'XX产品采购合同',
    initiators: [req1Signers[0]],
    signers: req1Signers,
    signing_order: 'sequential',
    status: 'signed',
    created_at: daysAgo(3),
    expires_at: daysAfter(7),
    completed_at: daysAgo(1),
    document_hash: generateDocumentHash('XX产品采购合同-模拟文档内容'),
    certificate_info: {
      issuer: 'CFCA 数字证书认证中心',
      subject: 'CN=contract-mock-001, O=Contract Review Agent, C=CN',
      serial_number: 'A1B2C3D4E5F60718293A4B5C6D7E8F90',
      valid_from: daysAgo(30),
      valid_to: daysAfter(335),
      algorithm: 'SHA-256 with RSA',
    },
    audit_trail: [
      { timestamp: daysAgo(3), action: 'request_created', actor: '系统', details: '创建签章请求，合同「XX产品采购合同」，签署顺序：sequential，签署人 2 名，有效期 10 天', ip_address: '192.168.1.10' },
      { timestamp: daysAgo(3), action: 'document_hashed', actor: '系统', details: '文档哈希生成完成：3a7f2c8b9e...', ip_address: '192.168.1.10' },
      { timestamp: daysAgo(3), action: 'certificate_issued', actor: 'CFCA 数字证书认证中心', details: '数字证书已签发，序列号：A1B2C3D4E5F60718293A4B5C6D7E8F90', ip_address: '192.168.1.10' },
      { timestamp: daysAgo(2), action: 'document_signed', actor: '张法务', details: '签署人「张法务（甲方代表）」完成签署，IP：192.168.1.10，设备：Windows 10 / Chrome 120', ip_address: '192.168.1.10' },
      { timestamp: daysAgo(1), action: 'document_signed', actor: '李供应商', details: '签署人「李供应商（乙方代表）」完成签署，IP：192.168.2.45，设备：macOS 14 / Safari 17', ip_address: '192.168.2.45' },
      { timestamp: daysAgo(1), action: 'request_completed', actor: '系统', details: '所有签署人已完成签署，签章请求状态更新为「已签」', ip_address: '192.168.2.45' },
    ],
  };

  // ----- 请求 2：待签署（并行签署，3 人，1 人已签）-----
  const req2Signers: Signer[] = [
    {
      id: 'sig-signer-003',
      name: '王总监',
      email: 'wangdz@company.com',
      role: '法务总监',
      status: 'signed',
      signed_at: hoursAfter(-12),
      ip_address: '192.168.1.18',
      device_info: 'macOS 14 / Safari 17',
    },
    {
      id: 'sig-signer-004',
      name: '赵经理',
      email: 'zhaojl@company.com',
      role: '业务经理',
      status: 'waiting',
    },
    {
      id: 'sig-signer-005',
      name: '孙财务',
      email: 'suncw@company.com',
      role: '财务主管',
      status: 'waiting',
    },
  ];
  const req2: SignatureRequest = {
    id: 'sig-002',
    contract_id: 'mock-002',
    contract_title: 'IT技术服务协议',
    initiators: [req2Signers[0]],
    signers: req2Signers,
    signing_order: 'parallel',
    status: 'pending',
    created_at: daysAgo(1),
    expires_at: daysAfter(9),
    document_hash: generateDocumentHash('IT技术服务协议-模拟文档内容'),
    certificate_info: {
      issuer: '北京数字认证股份有限公司 BJCA',
      subject: 'CN=contract-mock-002, O=Contract Review Agent, C=CN',
      serial_number: 'F0E1D2C3B4A5968778695A4B3C2D1E0F',
      valid_from: daysAgo(30),
      valid_to: daysAfter(335),
      algorithm: 'SHA-256 with RSA',
    },
    audit_trail: [
      { timestamp: daysAgo(1), action: 'request_created', actor: '系统', details: '创建签章请求，合同「IT技术服务协议」，签署顺序：parallel，签署人 3 名，有效期 10 天', ip_address: '192.168.1.18' },
      { timestamp: daysAgo(1), action: 'document_hashed', actor: '系统', details: '文档哈希生成完成：7c3e9a1d2f...', ip_address: '192.168.1.18' },
      { timestamp: daysAgo(1), action: 'certificate_issued', actor: '北京数字认证股份有限公司 BJCA', details: '数字证书已签发，序列号：F0E1D2C3B4A5968778695A4B3C2D1E0F', ip_address: '192.168.1.18' },
      { timestamp: hoursAfter(-12), action: 'document_signed', actor: '王总监', details: '签署人「王总监（法务总监）」完成签署，IP：192.168.1.18，设备：macOS 14 / Safari 17', ip_address: '192.168.1.18' },
    ],
  };

  // ----- 请求 3：已拒签（顺序签署，1 人拒签）-----
  const req3Signers: Signer[] = [
    {
      id: 'sig-signer-006',
      name: '周法务',
      email: 'zhoufw@company.com',
      role: '甲方代表',
      status: 'waiting',
    },
    {
      id: 'sig-signer-007',
      name: '吴租户',
      email: 'wuzh@tenant.com',
      role: '乙方代表',
      status: 'rejected',
      signed_at: daysAgo(4),
      ip_address: '192.168.3.22',
      device_info: 'iOS 17 / Mobile',
    },
  ];
  const req3: SignatureRequest = {
    id: 'sig-003',
    contract_id: 'mock-003',
    contract_title: '办公室租赁合同',
    initiators: [req3Signers[0]],
    signers: req3Signers,
    signing_order: 'sequential',
    status: 'rejected',
    created_at: daysAgo(6),
    expires_at: daysAfter(4),
    completed_at: daysAgo(4),
    document_hash: generateDocumentHash('办公室租赁合同-模拟文档内容'),
    certificate_info: {
      issuer: '上海市数字证书认证中心 SHECA',
      subject: 'CN=contract-mock-003, O=Contract Review Agent, C=CN',
      serial_number: 'B5C4D3E2F1A0988776655443322110AFF',
      valid_from: daysAgo(60),
      valid_to: daysAfter(305),
      algorithm: 'SHA-256 with RSA',
    },
    audit_trail: [
      { timestamp: daysAgo(6), action: 'request_created', actor: '系统', details: '创建签章请求，合同「办公室租赁合同」，签署顺序：sequential，签署人 2 名，有效期 10 天', ip_address: '192.168.1.10' },
      { timestamp: daysAgo(6), action: 'document_hashed', actor: '系统', details: '文档哈希生成完成：9e2a5f7c1b...', ip_address: '192.168.1.10' },
      { timestamp: daysAgo(6), action: 'certificate_issued', actor: '上海市数字证书认证中心 SHECA', details: '数字证书已签发，序列号：B5C4D3E2F1A0988776655443322110AFF', ip_address: '192.168.1.10' },
      { timestamp: daysAgo(5), action: 'document_signed', actor: '周法务', details: '签署人「周法务（甲方代表）」完成签署，IP：192.168.1.10，设备：Windows 11 / Edge 120', ip_address: '192.168.1.10' },
      { timestamp: daysAgo(4), action: 'signature_rejected', actor: '吴租户', details: '签署人「吴租户（乙方代表）」拒签，原因：租金条款与前期协商不符，要求修改后再签，IP：192.168.3.22', ip_address: '192.168.3.22' },
    ],
  };

  // ----- 请求 4：待签署（任意顺序，2 人，均未签）-----
  const req4Signers: Signer[] = [
    {
      id: 'sig-signer-008',
      name: '郑经理',
      email: 'zhengjl@company.com',
      role: '采购经理',
      status: 'waiting',
    },
    {
      id: 'sig-signer-009',
      name: '陈总监',
      email: 'chenjz@partner.com',
      role: '合作方总监',
      status: 'waiting',
    },
  ];
  const req4: SignatureRequest = {
    id: 'sig-004',
    contract_id: 'mock-004',
    contract_title: '市场推广合作协议',
    initiators: [req4Signers[0]],
    signers: req4Signers,
    signing_order: 'any',
    status: 'pending',
    created_at: hoursAfter(-6),
    expires_at: daysAfter(14),
    document_hash: generateDocumentHash('市场推广合作协议-模拟文档内容'),
    certificate_info: {
      issuer: '深圳市电子证书认证中心',
      subject: 'CN=contract-mock-004, O=Contract Review Agent, C=CN',
      serial_number: 'D1E2F3A4B5C60718293A4B5C6D7E8F900',
      valid_from: daysAgo(15),
      valid_to: daysAfter(350),
      algorithm: 'SHA-256 with RSA',
    },
    audit_trail: [
      { timestamp: hoursAfter(-6), action: 'request_created', actor: '系统', details: '创建签章请求，合同「市场推广合作协议」，签署顺序：any，签署人 2 名，有效期 15 天', ip_address: '192.168.1.24' },
      { timestamp: hoursAfter(-6), action: 'document_hashed', actor: '系统', details: '文档哈希生成完成：5c8b3e1f9a...', ip_address: '192.168.1.24' },
      { timestamp: hoursAfter(-6), action: 'certificate_issued', actor: '深圳市电子证书认证中心', details: '数字证书已签发，序列号：D1E2F3A4B5C60718293A4B5C6D7E8F90', ip_address: '192.168.1.24' },
    ],
  };

  return [req1, req2, req3, req4];
}

// ===== 签章统计 =====
// 计算总数、待签、已签、拒签数量与平均签署时长（小时）
export function getSignatureStats(requests: SignatureRequest[]): {
  total: number;
  pending: number;
  signed: number;
  rejected: number;
  avgSignTime: number;
} {
  const total = requests.length;
  const pending = requests.filter((r) => r.status === 'pending').length;
  const signed = requests.filter((r) => r.status === 'signed').length;
  const rejected = requests.filter((r) => r.status === 'rejected').length;

  // 计算平均签署时长：仅统计已签署完成的请求
  // 时长 = completed_at - created_at（换算为小时）
  const signTimes: number[] = [];
  for (const r of requests) {
    if (r.status === 'signed' && r.completed_at) {
      const created = new Date(r.created_at).getTime();
      const completed = new Date(r.completed_at).getTime();
      const hours = (completed - created) / (60 * 60 * 1000);
      if (hours >= 0) signTimes.push(hours);
    }
  }
  const avgSignTime =
    signTimes.length > 0
      ? Math.round((signTimes.reduce((s, h) => s + h, 0) / signTimes.length) * 10) / 10
      : 0;

  return { total, pending, signed, rejected, avgSignTime };
}

// ===== 内存存储（演示模式）=====
// 初始化为 Mock 数据，API 路由会读写此数组
export let signatureStore: SignatureRequest[] = getMockSignatureRequests();

// 重置内存存储为初始 Mock 数据（供 API 重置或调试使用）
export function resetSignatureStore(): void {
  signatureStore = getMockSignatureRequests();
}

// 重新导出状态配置，方便页面统一引用
export { SIGNATURE_STATUS_CONFIG, SIGNER_STATUS_CONFIG };
