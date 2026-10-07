/** Project integration surface for the pinned Deno npm import; no runtime code. */
declare module "npm:unpdf@0.12.1" {
  export function getDocumentProxy(bytes: Uint8Array, options?: Record<string, unknown>): Promise<{
    numPages: number;
    getPage(page: number): Promise<{
      streamTextContent(): ReadableStream<{ items: { str?: string; hasEOL?: boolean }[] }>;
      cleanup(): unknown;
    }>;
    destroy(): Promise<unknown>;
  }>;
}
