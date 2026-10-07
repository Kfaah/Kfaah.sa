import { RuleModeError } from './automation-policy.ts';
/** Count bytes while consuming and cancel before buffering an unbounded body. */
export async function readBoundedBytes(body: ReadableStream<Uint8Array> | null, limit: number): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new RuleModeError('body_too_large', 'حجم البيانات أكبر من الحد المسموح.', 413);
      }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total);
  let offset=0;
  for (const chunk of chunks) { result.set(chunk,offset); offset+=chunk.byteLength; }
  return result;
}
