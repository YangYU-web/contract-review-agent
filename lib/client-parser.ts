// ===== 客户端文档解析模块 =====
// 在浏览器端解析 PDF 和 DOCX，避免 Edge Runtime 兼容问题

// PDF.js 动态加载
let pdfjsLib: any = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  // 使用 CDN 版本的 pdf.js worker
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/legacy/build/pdf.worker.min.mjs';
  pdfjsLib = pdfjs;
  return pdfjsLib;
}

// 客户端 PDF 解析
export async function parsePDFClient(file: File): Promise<string> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n\n';
  }
  
  return fullText.trim();
}

// 客户端 DOCX 解析（使用 fflate 解压）
export async function parseDocxClient(file: File): Promise<string> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const arrayBuffer = await file.arrayBuffer();
  const files = unzipSync(new Uint8Array(arrayBuffer));
  
  const documentXml = files['word/document.xml'];
  if (!documentXml) {
    throw new Error('DOCX 文件格式无效');
  }
  
  const xmlText = strFromU8(documentXml);
  return extractTextFromDocxXml(xmlText);
}

// 从 DOCX XML 中提取文本
function extractTextFromDocxXml(xml: string): string {
  const result: string[] = [];
  
  // 按段落分割
  const paragraphs = xml.split(/<w:p[\s>]/);
  
  for (const para of paragraphs) {
    const texts: string[] = [];
    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let match;
    while ((match = tRegex.exec(para)) !== null) {
      texts.push(decodeXmlEntities(match[1]));
    }
    if (texts.length > 0) {
      result.push(texts.join(''));
    }
  }
  
  return result.join('\n');
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// 客户端 TXT 解析
export async function parseTxtClient(file: File): Promise<string> {
  return await file.text();
}

// 主解析函数
export async function parseDocumentClient(file: File): Promise<string> {
  const filename = file.name.toLowerCase();
  
  if (filename.endsWith('.pdf')) {
    return parsePDFClient(file);
  } else if (filename.endsWith('.docx')) {
    return parseDocxClient(file);
  } else if (filename.endsWith('.txt')) {
    return parseTxtClient(file);
  } else {
    throw new Error('不支持的文件格式，请上传 PDF、Word 或文本文件');
  }
}
