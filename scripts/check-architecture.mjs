import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = process.cwd();
const engine = path.join(root, 'packages/engine');
const app = path.join(root, 'apps/lol/src');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? (['node_modules', '.next', '.git'].includes(e.name) ? [] : walk(p)) : /\.tsx?$/.test(p) ? [p] : [];
});
const files = [...walk(engine), ...walk(app)];
const graph = new Map();
const forbidden = new Set();
const errors = [];
function resolve(from, spec) {
  const base = spec.startsWith('@rift/engine/') ? path.join(engine, spec.slice(13))
    : spec.startsWith('@/') ? path.join(app, spec.slice(2))
    : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  return [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
}
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const onlyTypes = clause?.isTypeOnly || node.isTypeOnly || (named && ts.isNamedImports(named) && !clause.name && named.elements.length > 0 && named.elements.every((e) => e.isTypeOnly));
      if (!onlyTypes && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const edges = [];
  for (const spec of imports) {
    if (file.startsWith(engine + '/') && (spec.startsWith('@/') || spec.includes('apps/') || spec.includes('/data/'))) errors.push(`${path.relative(root, file)}: engine imports game code ${spec}`);
    if (spec === 'server-only' || spec.startsWith('node:')) forbidden.add(file);
    const target = resolve(file, spec);
    if (target) {
      edges.push(target);
      if (target.includes('/data/') && !target.endsWith('/meta.json')) forbidden.add(target);
      if (file.startsWith(engine + '/') && target.startsWith(app + '/')) errors.push(`${file}: engine imports app`);
    }
  }
  graph.set(file, edges);
}
for (const file of files) {
  if (!/^['"]use client['"];?/m.test(fs.readFileSync(file, 'utf8'))) continue;
  const seen = new Set();
  function check(current, chain) {
    if (seen.has(current)) return;
    seen.add(current);
    if (forbidden.has(current)) errors.push('Client/server boundary: ' + [...chain, current].map((p) => path.relative(root, p)).join(' → '));
    for (const target of graph.get(current) ?? []) check(target, [...chain, current]);
  }
  check(file, []);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Architecture OK: ${files.length} modules`);
