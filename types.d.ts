declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: {
      PDFFormatVersion?: string;
      IsAcroFormPresent?: boolean;
      IsCollectionPresent?: boolean;
      [key: string]: any;
    };
    metadata: {
      info: { [key: string]: any };
      metadata?: { [key: string]: any };
    };
    version: string | null;
  }

  function pdfParse(buffer: Buffer): Promise<PDFData>;
  export default pdfParse;
}

declare module 'mammoth' {
  interface ExtractResult {
    value: string;
    messages: { type: string; message: string }[];
  }

  export function extractRawText(options: { buffer: Buffer }): Promise<ExtractResult>;
}
