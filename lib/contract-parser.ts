// ===== 文档解析模块 =====
// 支持PDF和Word文档的文本提取

// 动态导入避免构建时问题
async function parsePDF(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
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
