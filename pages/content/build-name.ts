const reservedIdentifiers = new Set([
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const legalIdentifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const toIifeGlobalName = (entryName: string): string => {
  if (legalIdentifierPattern.test(entryName) && !reservedIdentifiers.has(entryName)) {
    return entryName;
  }

  return `contentScript_${entryName.replace(/[^A-Za-z0-9_$]/g, '_')}`;
};

export { toIifeGlobalName };
