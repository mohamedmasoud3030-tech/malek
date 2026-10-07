import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(currentDirectory, '../..');
const triggerComponents = new Set([
  'DialogTrigger',
  'DialogClose',
  'DropdownMenuTrigger',
  'PopoverTrigger',
  'SheetTrigger',
  'TooltipTrigger',
  'DrawerTrigger',
]);

function listTsxFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTsxFiles(absolutePath);
    if (!entry.name.endsWith('.tsx')) return [];
    if (entry.name.includes('.test.') || entry.name.includes('.e2e-fixture.')) return [];
    return [absolutePath];
  });
}

function getAttributeNames(attributes: ts.JsxAttributes) {
  return new Set(
    attributes.properties
      .filter(ts.isJsxAttribute)
      .map((attribute) => attribute.name.getText()),
  );
}

function hasSpreadAttributes(attributes: ts.JsxAttributes) {
  return attributes.properties.some(ts.isJsxSpreadAttribute);
}

function isWrappedByActionTrigger(node: ts.Node, sourceFile: ts.SourceFile) {
  let parent: ts.Node | undefined = node.parent;
  while (parent && !ts.isJsxElement(parent)) parent = parent.parent;
  if (!parent || !ts.isJsxElement(parent)) return false;

  const triggerName = parent.openingElement.tagName.getText(sourceFile);
  if (!triggerComponents.has(triggerName)) return false;
  return getAttributeNames(parent.openingElement.attributes).has('asChild');
}

function inspectButton(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  filePath: string,
) {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  if (opening.tagName.getText(sourceFile) !== 'Button') return null;

  const attributeNames = getAttributeNames(opening.attributes);
  const hasEventHandler = [...attributeNames].some((name) => /^on[A-Z]/.test(name));
  const isWired =
    hasEventHandler
    || attributeNames.has('asChild')
    || attributeNames.has('form')
    || attributeNames.has('type')
    || hasSpreadAttributes(opening.attributes)
    || isWrappedByActionTrigger(node, sourceFile);

  if (isWired) return null;

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile));
  return `${path.relative(sourceRoot, filePath)}:${line + 1}:${character + 1}`;
}

describe('application button action contract', () => {
  it('does not leave inert Button components in production pages', () => {
    const offenders: string[] = [];

    for (const filePath of listTsxFiles(sourceRoot)) {
      const sourceText = fs.readFileSync(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

      const visit = (node: ts.Node) => {
        if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
          const offender = inspectButton(node, sourceFile, filePath);
          if (offender) offenders.push(offender);
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    expect(offenders, `Buttons without an action contract:\n${offenders.join('\n')}`).toEqual([]);
  });
});
