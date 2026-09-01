import { buildXlsxBlob } from '@/lib/xlsx-export';
import { withUtf8Bom } from '@/lib/csvExport';

export type OfficeImportEntity = 'owners' | 'properties' | 'units' | 'tenants' | 'contracts';
export type OfficeImportRow = Readonly<Record<string, string>>;
export type OfficeImportIssue = Readonly<{
  row: number;
  field?: string;
  message: string;
}>;
export type OfficeImportPreview = Readonly<{
  entity: OfficeImportEntity;
  headers: readonly string[];
  rows: readonly OfficeImportRow[];
  validRows: readonly OfficeImportRow[];
  issues: readonly OfficeImportIssue[];
  canCommit: boolean;
}>;

type FieldSpec = Readonly<{
  key: string;
  label: string;
  aliases: readonly string[];
  required?: boolean;
  validate?: (value: string, row: OfficeImportRow) => string | null;
}>;

type EntitySpec = Readonly<{
  label: string;
  fields: readonly FieldSpec[];
  naturalKey: readonly string[];
  sample: OfficeImportRow;
}>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function optionalEmail(value: string) {
  return !value || emailPattern.test(value) ? null : 'صيغة البريد الإلكتروني غير صحيحة';
}

function positiveAmount(value: string) {
  if (!value) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? null : 'يجب أن تكون القيمة رقمًا أكبر من صفر';
}

function optionalDate(value: string) {
  return !value || isoDatePattern.test(value) ? null : 'استخدم التاريخ بصيغة YYYY-MM-DD';
}

function percentage(value: string) {
  if (!value) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 100 ? null : 'النسبة يجب أن تكون أكبر من 0 وحتى 100';
}

export const officeImportSpecs: Readonly<Record<OfficeImportEntity, EntitySpec>> = {
  owners: {
    label: 'الملاك',
    naturalKey: ['full_name'],
    fields: [
      { key: 'full_name', label: 'اسم المالك', aliases: ['اسم المالك', 'المالك', 'full name', 'full_name', 'owner name', 'name'], required: true },
      { key: 'phone', label: 'الهاتف', aliases: ['الهاتف', 'هاتف', 'phone', 'mobile'] },
      { key: 'email', label: 'البريد الإلكتروني', aliases: ['البريد الإلكتروني', 'البريد', 'email', 'e-mail'], validate: optionalEmail },
      { key: 'national_id', label: 'الرقم المدني', aliases: ['الرقم المدني', 'الرقم الشخصي', 'national id', 'national_id', 'civil id'] },
      { key: 'tax_number', label: 'الرقم الضريبي', aliases: ['الرقم الضريبي', 'tax number', 'tax_number', 'vat number'] },
      { key: 'address', label: 'العنوان', aliases: ['العنوان', 'address'] },
      { key: 'notes', label: 'ملاحظات', aliases: ['ملاحظات', 'notes', 'note'] },
    ],
    sample: { full_name: 'أحمد الحارثي', phone: '+96890000000', email: 'owner@example.com', national_id: '', tax_number: '', address: 'مسقط', notes: '' },
  },
  properties: {
    label: 'العقارات',
    naturalKey: ['title'],
    fields: [
      { key: 'title', label: 'اسم العقار', aliases: ['اسم العقار', 'العقار', 'title', 'property', 'property name'], required: true },
      { key: 'type', label: 'النوع', aliases: ['النوع', 'type', 'property type'] },
      { key: 'address', label: 'العنوان', aliases: ['العنوان', 'address'], required: true },
      { key: 'owner_name', label: 'المالك الأساسي', aliases: ['المالك الأساسي', 'اسم المالك', 'owner', 'owner name', 'owner_name'], required: true },
      { key: 'ownership_percentage', label: 'نسبة الملكية', aliases: ['نسبة الملكية', 'ownership percentage', 'ownership_percentage', 'share'], validate: percentage },
      { key: 'agreement_start', label: 'بداية اتفاقية المالك', aliases: ['بداية اتفاقية المالك', 'agreement start', 'agreement_start'], validate: optionalDate },
      { key: 'status', label: 'الحالة', aliases: ['الحالة', 'status'] },
    ],
    sample: { title: 'برج النخيل', type: 'residential', address: 'الخوير، مسقط', owner_name: 'أحمد الحارثي', ownership_percentage: '100', agreement_start: '2026-01-01', status: 'active' },
  },
  units: {
    label: 'الوحدات',
    naturalKey: ['property_title', 'unit_number'],
    fields: [
      { key: 'property_title', label: 'العقار', aliases: ['العقار', 'اسم العقار', 'property', 'property title', 'property_title'], required: true },
      { key: 'unit_number', label: 'رقم الوحدة', aliases: ['رقم الوحدة', 'الوحدة', 'unit', 'unit number', 'unit_number'], required: true },
      { key: 'floor', label: 'الطابق', aliases: ['الطابق', 'الدور', 'floor'] },
      { key: 'type', label: 'نوع الوحدة', aliases: ['نوع الوحدة', 'type', 'unit type', 'unit_type'] },
      { key: 'rent_amount', label: 'الإيجار', aliases: ['الإيجار', 'قيمة الإيجار', 'rent', 'rent amount', 'rent_amount'], validate: positiveAmount },
      { key: 'status', label: 'الحالة', aliases: ['الحالة', 'status'] },
    ],
    sample: { property_title: 'برج النخيل', unit_number: '101', floor: '1', type: 'apartment', rent_amount: '250.000', status: 'vacant' },
  },
  tenants: {
    label: 'المستأجرون',
    naturalKey: ['full_name', 'national_id'],
    fields: [
      { key: 'full_name', label: 'اسم المستأجر', aliases: ['اسم المستأجر', 'المستأجر', 'full name', 'full_name', 'tenant name', 'name'], required: true },
      { key: 'phone', label: 'الهاتف', aliases: ['الهاتف', 'هاتف', 'phone', 'mobile'] },
      { key: 'email', label: 'البريد الإلكتروني', aliases: ['البريد الإلكتروني', 'البريد', 'email', 'e-mail'], validate: optionalEmail },
      { key: 'national_id', label: 'الرقم المدني', aliases: ['الرقم المدني', 'الرقم الشخصي', 'national id', 'national_id', 'civil id'] },
      { key: 'address', label: 'العنوان', aliases: ['العنوان', 'address'] },
      { key: 'notes', label: 'ملاحظات', aliases: ['ملاحظات', 'notes', 'note'] },
    ],
    sample: { full_name: 'سالم البلوشي', phone: '+96891111111', email: 'tenant@example.com', national_id: '', address: 'مسقط', notes: '' },
  },
  contracts: {
    label: 'العقود',
    naturalKey: ['property_title', 'unit_number', 'tenant_name', 'start_date'],
    fields: [
      { key: 'property_title', label: 'العقار', aliases: ['العقار', 'اسم العقار', 'property', 'property_title'], required: true },
      { key: 'unit_number', label: 'رقم الوحدة', aliases: ['رقم الوحدة', 'الوحدة', 'unit', 'unit_number'], required: true },
      { key: 'tenant_name', label: 'المستأجر', aliases: ['المستأجر', 'اسم المستأجر', 'tenant', 'tenant name', 'tenant_name'], required: true },
      { key: 'start_date', label: 'تاريخ البداية', aliases: ['تاريخ البداية', 'بداية العقد', 'start date', 'start_date'], required: true, validate: optionalDate },
      { key: 'end_date', label: 'تاريخ النهاية', aliases: ['تاريخ النهاية', 'نهاية العقد', 'end date', 'end_date'], required: true, validate: optionalDate },
      { key: 'rent_amount', label: 'الإيجار', aliases: ['الإيجار', 'قيمة الإيجار', 'rent', 'rent amount', 'rent_amount'], required: true, validate: positiveAmount },
      { key: 'payment_frequency', label: 'دورية السداد', aliases: ['دورية السداد', 'payment frequency', 'payment_frequency', 'frequency'] },
      { key: 'reference', label: 'مرجع العقد', aliases: ['مرجع العقد', 'رقم العقد', 'reference', 'contract reference'] },
    ],
    sample: { property_title: 'برج النخيل', unit_number: '101', tenant_name: 'سالم البلوشي', start_date: '2026-01-01', end_date: '2026-12-31', rent_amount: '250.000', payment_frequency: 'monthly', reference: 'CON-001' },
  },
};

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[\s_-]+/g, ' ');
}

function aliasIndex(spec: EntitySpec) {
  const index = new Map<string, string>();
  for (const field of spec.fields) {
    index.set(normalizeHeader(field.key), field.key);
    index.set(normalizeHeader(field.label), field.key);
    for (const alias of field.aliases) index.set(normalizeHeader(alias), field.key);
  }
  return index;
}

export function parseCsvMatrix(input: string): string[][] {
  const source = input.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value.replace(/\r$/, ''));
      matrix.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error('ملف CSV يحتوي على قيمة مقتبسة غير مكتملة');
  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ''));
    matrix.push(row);
  }
  return matrix.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function columnIndexFromRef(ref: string) {
  const letters = ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? 'A';
  let result = 0;
  for (const char of letters) result = result * 26 + char.charCodeAt(0) - 64;
  return result - 1;
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error('ملف Excel غير صالح: تعذر قراءة فهرس ZIP');
}

type ZipDirectoryEntry = Readonly<{ name: string; method: number; compressedSize: number; size: number; localOffset: number }>;

function readZipDirectory(bytes: Uint8Array): ZipDirectoryEntry[] {
  const decoder = new TextDecoder();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(bytes);
  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipDirectoryEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('ملف Excel غير صالح: فهرس ZIP تالف');
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    entries.push({ name, method, compressedSize, size, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function unzipEntry(bytes: Uint8Array, entry: ZipDirectoryEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error('ملف Excel غير صالح: مدخل ZIP تالف');
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method !== 8) throw new Error(`ضغط Excel غير مدعوم (${entry.method})`);
  if (typeof DecompressionStream === 'undefined') throw new Error('المتصفح لا يدعم فك ضغط ملف Excel. استخدم CSV كبديل.');
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const output = new Uint8Array(await new Response(stream).arrayBuffer());
  if (entry.size && output.length !== entry.size) throw new Error('ملف Excel غير صالح: حجم البيانات لا يطابق الفهرس');
  return output;
}

function xmlDocument(source: string) {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('ملف Excel يحتوي على XML غير صالح');
  return doc;
}

function worksheetPath(workbookXml: string, relsXml: string) {
  const workbook = xmlDocument(workbookXml);
  const firstSheet = workbook.querySelector('sheet');
  const relationId = firstSheet?.getAttribute('r:id') ?? firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  if (!relationId) return 'xl/worksheets/sheet1.xml';
  const rels = xmlDocument(relsXml);
  const relation = Array.from(rels.querySelectorAll('Relationship')).find((item) => item.getAttribute('Id') === relationId);
  const target = relation?.getAttribute('Target') ?? 'worksheets/sheet1.xml';
  return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
}

function parseWorksheet(source: string, sharedStrings: readonly string[]): string[][] {
  const doc = xmlDocument(source);
  const matrix: string[][] = [];
  for (const rowNode of Array.from(doc.querySelectorAll('sheetData > row'))) {
    const row: string[] = [];
    for (const cell of Array.from(rowNode.querySelectorAll('c'))) {
      const ref = cell.getAttribute('r') ?? 'A1';
      const index = columnIndexFromRef(ref);
      const type = cell.getAttribute('t');
      let value = '';
      if (type === 'inlineStr') value = cell.querySelector('is')?.textContent ?? '';
      else {
        const raw = cell.querySelector('v')?.textContent ?? '';
        if (type === 's') value = sharedStrings[Number(raw)] ?? '';
        else if (type === 'b') value = raw === '1' ? 'true' : 'false';
        else value = raw;
      }
      row[index] = value;
    }
    matrix.push(row.map((cell) => cell ?? ''));
  }
  return matrix.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

export async function parseXlsxMatrix(bytes: Uint8Array): Promise<string[][]> {
  const entries = readZipDirectory(bytes);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const decoder = new TextDecoder();
  const readText = async (name: string) => {
    const entry = byName.get(name);
    if (!entry) return '';
    return decoder.decode(await unzipEntry(bytes, entry));
  };

  const sharedSource = await readText('xl/sharedStrings.xml');
  const sharedStrings = sharedSource
    ? Array.from(xmlDocument(sharedSource).querySelectorAll('si')).map((node) => node.textContent ?? '')
    : [];
  const workbookSource = await readText('xl/workbook.xml');
  const relsSource = await readText('xl/_rels/workbook.xml.rels');
  const sheetPath = workbookSource && relsSource ? worksheetPath(workbookSource, relsSource) : 'xl/worksheets/sheet1.xml';
  const sheetSource = await readText(sheetPath);
  if (!sheetSource) throw new Error('ملف Excel لا يحتوي على ورقة عمل قابلة للقراءة');
  return parseWorksheet(sheetSource, sharedStrings);
}

export async function parseOfficeImportFile(file: File): Promise<string[][]> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.csv')) return parseCsvMatrix(await file.text());
  if (lowerName.endsWith('.xlsx')) return parseXlsxMatrix(new Uint8Array(await file.arrayBuffer()));
  throw new Error('الصيغ المدعومة هي CSV و XLSX فقط');
}

export function buildOfficeImportPreview(entity: OfficeImportEntity, matrix: readonly (readonly string[])[]): OfficeImportPreview {
  const spec = officeImportSpecs[entity];
  const rawHeaders = matrix[0]?.map((value) => value.trim()) ?? [];
  const lookup = aliasIndex(spec);
  const mappedHeaders = rawHeaders.map((header) => lookup.get(normalizeHeader(header)) ?? '');
  const issues: OfficeImportIssue[] = [];
  const seenHeaders = new Set<string>();

  mappedHeaders.forEach((header, index) => {
    if (!header) {
      if (rawHeaders[index]?.trim()) issues.push({ row: 1, message: `عمود غير معروف: ${rawHeaders[index]}` });
      return;
    }
    if (seenHeaders.has(header)) issues.push({ row: 1, field: header, message: `العمود مكرر: ${rawHeaders[index]}` });
    seenHeaders.add(header);
  });

  for (const field of spec.fields.filter((item) => item.required)) {
    if (!mappedHeaders.includes(field.key)) issues.push({ row: 1, field: field.key, message: `العمود المطلوب غير موجود: ${field.label}` });
  }

  const rows: OfficeImportRow[] = [];
  for (let index = 1; index < matrix.length; index += 1) {
    const sourceRow = matrix[index] ?? [];
    if (!sourceRow.some((value) => value.trim())) continue;
    const record: Record<string, string> = {};
    mappedHeaders.forEach((key, column) => {
      if (key) record[key] = (sourceRow[column] ?? '').trim();
    });
    rows.push(record);
    for (const field of spec.fields) {
      const value = record[field.key] ?? '';
      if (field.required && !value) issues.push({ row: index + 1, field: field.key, message: `${field.label} مطلوب` });
      const validation = field.validate?.(value, record) ?? null;
      if (validation) issues.push({ row: index + 1, field: field.key, message: `${field.label}: ${validation}` });
    }
    if (entity === 'contracts' && record.start_date && record.end_date && record.end_date < record.start_date) {
      issues.push({ row: index + 1, field: 'end_date', message: 'تاريخ نهاية العقد يجب ألا يسبق تاريخ البداية' });
    }
  }

  const duplicateRows = new Map<string, number>();
  rows.forEach((row, rowIndex) => {
    const key = spec.naturalKey.map((field) => (row[field] ?? '').trim().toLocaleLowerCase('ar')).join('|');
    if (!key.replaceAll('|', '')) return;
    const first = duplicateRows.get(key);
    if (first !== undefined) issues.push({ row: rowIndex + 2, message: `سجل مكرر داخل الملف (يطابق الصف ${first + 2})` });
    else duplicateRows.set(key, rowIndex);
  });

  if (rows.length === 0) issues.push({ row: 1, message: 'الملف لا يحتوي على سجلات بيانات' });
  const invalidRows = new Set(issues.filter((issue) => issue.row > 1).map((issue) => issue.row));
  const validRows = rows.filter((_, index) => !invalidRows.has(index + 2));
  return {
    entity,
    headers: spec.fields.map((field) => field.key),
    rows,
    validRows,
    issues,
    canCommit: rows.length > 0 && issues.length === 0,
  };
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildOfficeImportTemplate(entity: OfficeImportEntity, format: 'csv' | 'xlsx') {
  const spec = officeImportSpecs[entity];
  const headers = spec.fields.map((field) => field.label);
  const row = spec.fields.map((field) => spec.sample[field.key] ?? '');
  const baseName = `malek-${entity}-import-template`;
  if (format === 'xlsx') {
    return { filename: `${baseName}.xlsx`, blob: buildXlsxBlob({ name: spec.label, headers, rows: [row] }) };
  }
  const csv = [headers.map(csvEscape).join(','), row.map(csvEscape).join(',')].join('\n');
  return { filename: `${baseName}.csv`, blob: new Blob([withUtf8Bom(csv)], { type: 'text/csv;charset=utf-8' }) };
}
