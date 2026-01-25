import type { User, Group, SchemaAttribute } from './types';

/**
 * Format users as a table
 */
export function formatUsersTable(users: User[]): string {
  const headers = ['User ID (user_id)', 'Email (mail)', 'Display Name (display_name)'];
  const rows = users.map((u) => [u.id, u.email, u.displayName]);
  return formatTable(headers, rows);
}

/**
 * Format users as a compact table with just uid and email
 */
export function formatUsersCompactTable(users: User[]): string {
  const headers = ['User ID', 'Email'];
  const rows = users.map((u) => [u.id, u.email]);
  return formatTable(headers, rows);
}

/**
 * Format groups as a table
 */
export function formatGroupsTable(groups: Group[]): string {
  const headers = ['Group ID', 'Creation date', 'UUID', 'Display Name'];
  const rows = groups.map((g) => [String(g.id), g.creationDate, g.uuid, g.displayName]);
  return formatTable(headers, rows);
}

/**
 * Format schema attributes as a table
 */
export function formatSchemaAttributesTable(attributes: SchemaAttribute[]): string {
  const headers = ['Name', 'Type', 'Is list', 'Is visible', 'Is editable'];
  const rows = attributes.map((a) => [
    a.name,
    a.attributeType,
    String(a.isList),
    String(a.isVisible),
    String(a.isEditable),
  ]);
  return formatTable(headers, rows);
}

/**
 * Generic table formatter
 */
function formatTable(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows];

  // Calculate column widths
  const widths = headers.map((_, i) => Math.max(...allRows.map((row) => (row[i] || '').length)));

  // Format header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
  const separatorLine = widths.map((w) => '-'.repeat(w)).join('  ');

  // Format data rows
  const dataLines = rows.map((row) => row.map((cell, i) => (cell || '').padEnd(widths[i])).join('  '));

  return [headerLine, separatorLine, ...dataLines].join('\n');
}

/**
 * Format a list (one item per line)
 */
export function formatList(items: string[]): string {
  return items.join('\n');
}
