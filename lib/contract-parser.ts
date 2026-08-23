// ===== 文档解析模块（Edge Runtime 兼容） =====
// 使用 unpdf 替代 pdf-parse，使用 fflate 替代 mammoth
// 支持 PDF 和 Word 文档的文本提取

import { extractText } from 'unpdf';
import { unzipSync, strFromU8 } from 'fflate';

// PDF 解析（Edge 兼容）
async function parsePDF(buffer: Buffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer), { maxPages: 0 });
  return text;
}

// DOCX 解析（Edge 兼容，使用 fflate 解压 + XML 解析）
function parseDocx(buffer: Buffer): string {
  // DOCX 是 ZIP 格式，解压后读取 word/document.xml
  const files = unzipSync(new Uint8Array(buffer));
  const documentXml = files['word/document.xml'];
  if (!documentXml) {
    throw new Error('DOCX 文件格式无效：未找到 word/document.xml');
  }
  const xmlText = strFromU8(documentXml);
  return extractTextFromDocxXml(xmlText);
}

// 从 DOCX 的 XML 中提取纯文本
function extractTextFromDocxXml(xml: string): string {
  // 移除 XML 命名空间声明和处理指令
  let text = xml;

  // 提取 <w:t> 标签内容（Word 文档中的文本节点）
  const textParts: string[] = [];
  const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    textParts.push(decodeXmlEntities(match[1]));
  }

  // 段落分隔：<w:p> 标签表示段落
  const paragraphRegex = /<w:p[\s>]/g;
  const paragraphPositions: number[] = [];
  let pMatch;
  while ((pMatch = paragraphRegex.exec(text)) !== null) {
    paragraphPositions.push(pMatch.index);
  }

  // 如果没有提取到文本，返回空字符串
  if (textParts.length === 0) {
    return '';
  }

  // 按段落组合文本
  const result: string[] = [];
  let textIndex = 0;
  let lastPos = 0;

  for (const pos of paragraphPositions) {
    // 收集该段落之前的所有文本
    const chunkEnd = text.indexOf('<w:t', pos);
    if (chunkEnd === -1) continue;

    // 找到段落范围内的文本
    const nextParagraphPos = paragraphPositions[paragraphPositions.indexOf(pos) + 1] ?? text.length;

    // 提取段落内所有 <w:t> 内容
    const paragraphTexts: string[] = [];
    let searchStart = pos;
    while (searchStart < nextParagraphPos) {
      const tStart = text.indexOf('<w:t', searchStart);
      if (tStart === -1 || tStart >= nextParagraphPos) break;
      const tContentStart = text.indexOf('>', tStart) + 1;
      const tEnd = text.indexOf('</w:t>', tContentStart);
      if (tEnd === -1) break;
      paragraphTexts.push(decodeXmlEntities(text.substring(tContentStart, tEnd)));
      searchStart = tEnd + 6;
    }

    if (paragraphTexts.length > 0) {
      result.push(paragraphTexts.join(''));
    }
  }

  // 如果段落方法没有提取到内容，使用简单方法
  if (result.length === 0) {
    return textParts.join('\n');
  }

  return result.join('\n');
}

// 解码 XML 实体
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// 主解析函数
export async function parseDocument(
  buffer: Buffer,
  fileType: 'pdf' | 'docx' | 'txt'
): Promise<string> {
  switch (fileType) {
    case 'pdf':
      return parsePDF(buffer);
    case 'docx':
      return parseDocx(buffer);
    case 'txt':
      return buffer.toString('utf-8');
    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }
}

// 条款分割：按法律条款边界切分
export interface ClauseSegment {
  clause_number: string;
  clause_type: string;
  clause_text: string;
}

// 识别条款编号模式（如 "第一条" "1.1" "Article 1" 等）
const CLAUSE_PATTERNS = [
  /第[一二三四五六七八九十百千零〇]+条/g,
  /^\d+\.\d+/gm,
  /^\d+\)/gm,
  /^Article\s+\d+/gim,
  /^第[一二三四五六七八九十百千零〇]+章/g,
  /^第[一二三四五六七八九十百千零〇]+节/g,
];

// 检测条款类型
function detectClauseType(text: string): string {
  const typeMap: { keyword: string; type: string }[] = [
    { keyword: '付款|支付|货款|价款|金额|结算', type: 'payment' },
    { keyword: '交付|验收|发货|交货', type: 'delivery' },
    { keyword: '违约|违约金|赔偿', type: 'breach' },
    { keyword: '知识产权|专利|商标|著作权', type: 'ip' },
    { keyword: '保密|机密', type: 'confidentiality' },
    { keyword: '争议|仲裁|诉讼|管辖', type: 'dispute' },
    { keyword: '不可抗力', type: 'force_majeure' },
    { keyword: '终止|解除', type: 'termination' },
    { keyword: '赔偿| indemnif', type: 'indemnification' },
    { keyword: '数据|隐私|个人信息', type: 'data' },
    { keyword: '竞业', type: 'non_compete' },
    { keyword: '适用法律|管辖法律', type: 'governing_law' },
  ];

  for (const { keyword, type } of typeMap) {
    if (new RegExp(keyword, 'i').test(text)) return type;
  }
  return 'other';
}

// 条款分割主函数
export function splitIntoClauses(text: string): ClauseSegment[] {
  const clauses: ClauseSegment[] = [];

  // 尝试按"第X条"模式分割
  const articlePattern = /(第[一二三四五六七八九十百千零〇]+条[^\n]*)/g;
  const matches = text.match(articlePattern);

  if (matches && matches.length > 0) {
    // 找到每个条款的位置
    let lastIndex = 0;
    for (let i = 0; i < matches.length; i++) {
      const matchText = matches[i];
      const startIndex = text.indexOf(matchText, lastIndex);

      // 条款内容从当前位置到下一个条款开始
      const endIndex = i < matches.length - 1
        ? text.indexOf(matches[i + 1], startIndex + matchText.length)
        : text.length;

      const fullClause = text.substring(startIndex, endIndex).trim();
      if (fullClause.length > 10) {
        clauses.push({
          clause_number: matchText.replace(/\s+/g, ' '),
          clause_type: detectClauseType(fullClause),
          clause_text: fullClause,
        });
      }
      lastIndex = startIndex + matchText.length;
    }
  }

  // 如果没有找到"第X条"模式，按段落分割
  if (clauses.length === 0) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    paragraphs.forEach((para, idx) => {
      clauses.push({
        clause_number: `段落${idx + 1}`,
        clause_type: detectClauseType(para),
        clause_text: para.trim(),
      });
    });
  }

  return clauses;
}

// 检测合同类型
export function detectContractType(text: string): string {
  const typeMap: { keyword: string; type: string }[] = [
    { keyword: '采购|买卖|销售', type: '采购合同' },
    { keyword: '服务|外包|委托', type: '服务合同' },
    { keyword: '租赁|租金|承租', type: '租赁合同' },
    { keyword: '劳动|雇佣|试用期', type: '劳动合同' },
    { keyword: '合作|合伙', type: '合作协议' },
    { keyword: '许可|授权', type: '许可协议' },
    { keyword: '保密|NDA', type: '保密协议' },
    { keyword: '借款|贷款|利息', type: '借款合同' },
    { keyword: '承揽|施工|工程', type: '承揽合同' },
    { keyword: '技术开发|软件开发', type: '技术开发合同' },
  ];

  for (const { keyword, type } of typeMap) {
    if (new RegExp(keyword).test(text)) return type;
  }
  return '其他合同';
}

// 提取合同标题
export function extractContractTitle(text: string): string {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  // 取前5行中最可能为标题的一行
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length > 3 && trimmed.length < 50) {
      if (/合同|协议|契约|agreement|contract/i.test(trimmed)) {
        return trimmed;
      }
    }
  }
  // 如果没找到，取第一行
  return lines[0]?.trim().substring(0, 50) || '未命名合同';
}
