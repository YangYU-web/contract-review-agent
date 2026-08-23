// ===== OCR 扫描件识别模拟模块 =====
// 模拟扫描合同图片/PDF的OCR处理流程，生成页面文本、文本区域、置信度与警告

import {
  OCRResult,
  OCRPageResult,
  OcrTextRegion,
  OCRStatus,
  ContractLanguage,
} from './types';
import { detectLanguage } from './multilingual';

// 预置模拟合同页面文本（3页内容）
const MOCK_PAGES: string[] = [
  // 第1页：合同首部与基本信息
  `产品采购合同
合同编号：HT-2024-0815
甲方：北京宏远科技有限公司
乙方：上海智联实业股份有限公司
签订日期：2024年8月15日
签订地点：北京市朝阳区

根据《中华人民共和国民法典》及相关法律法规，甲乙双方在平等、自愿、公平和诚实信用的基础上，经友好协商，就产品采购事宜达成如下协议：`,

  // 第2页：付款与交付条款
  `第一条 合同总金额
本合同项下产品采购总金额为人民币伍拾万元整（￥500,000.00），含增值税。

第二条 付款方式
甲方应在合同签署后7个工作日内向乙方支付合同总金额的50%作为预付款；剩余50%款项在乙方交付全部货物并经甲方验收合格后10个工作日内付清。

第三条 交付安排
乙方应在收到甲方订单后45日内完成交付。交付地点为甲方指定仓库，运输费用由乙方承担。`,

  // 第3页：违约责任与争议解决
  `第四条 违约责任
任何一方违反本合同约定，应向守约方支付违约金，违约金金额为合同总金额的15%。如违约金不足以弥补守约方实际损失的，违约方应补足差额。

第五条 保密义务
乙方应对其在履行本合同过程中获知的甲方商业信息承担保密义务，保密期限为本合同终止后3年。

第六条 争议解决
双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。`,
];

/**
 * 获取模拟页面文本
 * 预存3页合同文本，页码超出时循环复用并追加页码标识
 */
export function getMockPageText(pageNum: number): string {
  const idx = (pageNum - 1) % MOCK_PAGES.length;
  const base = MOCK_PAGES[idx];
  // 超出预存页数时附加页码提示，保证内容不重复感
  if (pageNum > MOCK_PAGES.length) {
    return base.replace(/\n/g, '\n') + `\n（第${pageNum}页内容）`;
  }
  return base;
}

// 生成随机整数（含上下界）
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 生成随机置信度（偏向较高值，模拟真实OCR）
function randConfidence(): number {
  // 60-99 之间，加权使大部分落在 75-95
  const r = Math.random();
  if (r < 0.7) return randInt(75, 95);
  if (r < 0.9) return randInt(60, 75);
  return randInt(90, 99);
}

/**
 * 为一页文本生成模拟文本区域
 * 将文本按行切分，每行生成一个 OcrTextRegion，附带 bbox 坐标与置信度
 */
function generateRegions(pageText: string, baseY: number): OcrTextRegion[] {
  const lines = pageText.split('\n').filter(l => l.trim().length > 0);
  const regions: OcrTextRegion[] = [];
  let y = baseY;
  const pageWidth = 800;

  for (const line of lines) {
    const charCount = line.length;
    // 每个中文约 16px 宽度估算
    const estimatedWidth = Math.min(pageWidth - 80, Math.max(120, charCount * 16));
    const confidence = randConfidence();
    regions.push({
      bbox: {
        x: randInt(40, 60),
        y,
        width: estimatedWidth,
        height: randInt(22, 30),
      },
      text: line,
      confidence,
    });
    y += randInt(28, 36);
  }
  return regions;
}

/**
 * 模拟 OCR 处理过程
 * 逐页生成文本、文本区域、置信度，并汇总警告信息
 */
export function simulateOCR(
  filename: string,
  pageCount: number,
  language: ContractLanguage = 'zh'
): OCRResult {
  const now = new Date().toISOString();
  const pageResults: OCRPageResult[] = [];
  const warnings: string[] = [];
  const allText: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const pageText = getMockPageText(i);
    const regions = generateRegions(pageText, 60);

    // 页面置信度为该页各区域置信度的加权平均（按文本长度加权）
    const totalChars = regions.reduce((sum, r) => sum + r.text.length, 0) || 1;
    const weightedConfidence = regions.reduce(
      (sum, r) => sum + r.confidence * r.text.length,
      0
    ) / totalChars;
    const pageConfidence = Math.round(weightedConfidence);

    pageResults.push({
      page_number: i,
      text: pageText,
      confidence: pageConfidence,
      regions,
    });
    allText.push(`===== 第${i}页 =====\n${pageText}`);

    // 生成页级警告
    if (pageConfidence < 70) {
      warnings.push(`第${i}页识别置信度偏低（${pageConfidence}%），建议人工复核关键条款`);
    }
    if (pageConfidence < 65) {
      warnings.push(`第${i}页可能存在手写批注区域，OCR识别准确度受限`);
    }
    // 随机增加印章/水印遮挡警告
    if (Math.random() < 0.18) {
      warnings.push(`第${i}页存在印章/水印遮挡，部分文字可能识别不全`);
    }
  }

  // 部分页面可能识别失败（模拟扫描质量问题）
  if (pageCount >= 4 && Math.random() < 0.25) {
    const failedPage = randInt(2, pageCount);
    warnings.push(`第${failedPage}页图像模糊，建议重新扫描以提高识别质量`);
  }

  // 总置信度为各页平均值
  const totalConfidence = pageResults.length > 0
    ? Math.round(pageResults.reduce((sum, p) => sum + p.confidence, 0) / pageResults.length)
    : 0;

  // 合并全文并检测语言
  const extractedText = allText.join('\n\n');
  const detected = detectLanguage(extractedText);

  // 通用警告
  if (totalConfidence < 75) {
    warnings.unshift('整体识别置信度偏低，建议核对提取文本后再进行审查');
  }

  return {
    id: `ocr-${Date.now()}-${randInt(1000, 9999)}`,
    filename,
    status: 'completed',
    language: language !== 'bilingual' ? language : detected.language,
    total_pages: pageCount,
    processed_pages: pageCount,
    extracted_text: extractedText,
    confidence: totalConfidence,
    page_results: pageResults,
    warnings: warnings.length > 0 ? warnings : ['识别过程正常，无异常警告'],
    created_at: now,
    completed_at: new Date(Date.now() + pageCount * 800).toISOString(),
  };
}

// 预置历史 OCR 结果（3-4个），用于演示历史记录
export function getMockOCRResults(): OCRResult[] {
  const samples: { filename: string; pages: number; lang: ContractLanguage }[] = [
    { filename: '采购合同扫描件_20240801.pdf', pages: 3, lang: 'zh' },
    { filename: 'service_agreement_scan.jpg', pages: 2, lang: 'en' },
    { filename: '租赁合同_签字版.pdf', pages: 4, lang: 'zh' },
    { filename: '双语合同_bilingual.pdf', pages: 5, lang: 'bilingual' },
  ];

  const fixedTime = (offset: number) =>
    new Date(Date.now() - offset * 3600 * 1000).toISOString();

  return samples.map((s, idx) => {
    const result = simulateOCR(s.filename, s.pages, s.lang);
    return {
      ...result,
      id: `ocr-history-${idx + 1}`,
      created_at: fixedTime((idx + 1) * 6),
      completed_at: fixedTime((idx + 1) * 6 - 0.2),
    };
  });
}

/**
 * 汇总 OCR 结果统计
 */
export function getOCRStats(results: OCRResult[]): {
  total: number;
  completed: number;
  avgConfidence: number;
  totalPages: number;
} {
  if (results.length === 0) {
    return { total: 0, completed: 0, avgConfidence: 0, totalPages: 0 };
  }
  const completed = results.filter(r => r.status === 'completed').length;
  const avgConfidence = Math.round(
    results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length
  );
  const totalPages = results.reduce((sum, r) => sum + (r.total_pages || 0), 0);
  return {
    total: results.length,
    completed,
    avgConfidence,
    totalPages,
  };
}

// 重新导出便于API直接使用
export type { OCRResult, OCRPageResult, OcrTextRegion, OCRStatus };
