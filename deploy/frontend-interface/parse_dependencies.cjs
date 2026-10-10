'use strict';
// Trusted pinned parser only. Application source is data; never eval/import/require it.
const fs = require('node:fs');
const crypto = require('node:crypto');
const acorn = require('./vendor/acorn.cjs');
const MAX_BYTES = 256 * 1024 * 1024, MAX_FILE = 16 * 1024 * 1024;
function must(value) { if (!value) throw Error('ACORN_INPUT_OR_PARSE_NOT_CONFIRMED'); }
function literal(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis.length === 1 && typeof node.quasis[0].value.cooked === 'string') return node.quasis[0].value.cooked;
  return null;
}
function parse(source) {
  let tree, mode = 'module';
  try { tree = acorn.parse(source, {ecmaVersion: 'latest', sourceType: mode}); }
  catch { mode = 'script'; tree = acorn.parse(source, {ecmaVersion: 'latest', sourceType: mode}); }
  const stack = [tree], imports = new Set(); let nodes = 0, computed = 0;
  while (stack.length) {
    const node = stack.pop(); must(++nodes <= 5000000);
    if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type) && node.source) {
      const value = literal(node.source); must(value !== null); imports.add(value);
    } else if (node.type === 'ImportExpression') {
      const value = literal(node.source); if (value === null) computed++; else imports.add(value);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const child of value) if (child && typeof child.type === 'string') stack.push(child); }
      else if (value && typeof value === 'object' && typeof value.type === 'string') stack.push(value);
    }
  }
  must(imports.size <= 10000 && [...imports].every(value => Buffer.byteLength(value, 'utf8') <= 4096));
  return {imports: [...imports].sort(), computedImportCount: computed, sourceType: mode};
}
try {
  must(acorn.version === '8.15.0');
  const raw = fs.readFileSync(0); must(raw.length <= MAX_BYTES * 1.5);
  const input = JSON.parse(raw.toString('utf8')); must(Array.isArray(input) && input.length <= 10000);
  const graph = {}; let total = 0;
  for (const item of input) {
    must(item && Object.keys(item).sort().join(',') === 'sha256,size,source' && /^[a-f0-9]{64}$/.test(item.sha256) && Number.isSafeInteger(item.size) && item.size >= 0 && item.size <= MAX_FILE && typeof item.source === 'string');
    const bytes = Buffer.from(item.source, 'base64');
    must(bytes.toString('base64') === item.source && bytes.length === item.size && crypto.createHash('sha256').update(bytes).digest('hex') === item.sha256 && !(item.sha256 in graph));
    total += bytes.length; must(total <= MAX_BYTES);
    graph[item.sha256] = {size: item.size, ...parse(bytes.toString('utf8'))};
  }
  process.stdout.write(JSON.stringify(graph) + '\n');
} catch { process.stderr.write('ACORN_INPUT_OR_PARSE_NOT_CONFIRMED\n'); process.exitCode = 1; }
