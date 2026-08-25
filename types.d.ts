declare module 'unpdf' {
  interface ExtractTextResult {
    text: string;
    totalPages: number;
    info: Record<string, unknown>;
  }

  export function extractText(
    data: Uint8Array,
    options?: { maxPages?: number }
  ): Promise<ExtractTextResult>;
}

declare module 'fflate' {
  export function unzipSync(data: Uint8Array): Record<string, Uint8Array>;
  export function strFromU8(data: Uint8Array): string;
}

declare module 'pdfjs-dist/legacy/build/pdf' {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(params: { data: Uint8Array }): { promise: Promise<any> };
}
