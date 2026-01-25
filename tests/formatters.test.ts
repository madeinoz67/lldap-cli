import { describe, test, expect } from 'bun:test';
import {
  formatUsersTable,
  formatGroupsTable,
  formatSchemaAttributesTable,
  formatList,
} from '../src/formatters';
import type { User, Group, SchemaAttribute } from '../src/types';

describe('formatUsersTable', () => {
  test('formats users as table', () => {
    const users: User[] = [
      {
        id: 'jsmith',
        creationDate: '2024-01-01',
        uuid: 'uuid-1',
        email: 'john@example.com',
        displayName: 'John Smith',
        firstName: 'John',
        lastName: 'Smith',
      },
      {
        id: 'jdoe',
        creationDate: '2024-01-02',
        uuid: 'uuid-2',
        email: 'jane@example.com',
        displayName: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
      },
    ];

    const output = formatUsersTable(users);

    expect(output).toContain('User ID (user_id)');
    expect(output).toContain('Email (mail)');
    expect(output).toContain('Display Name (display_name)');
    expect(output).toContain('jsmith');
    expect(output).toContain('john@example.com');
    expect(output).toContain('John Smith');
    expect(output).toContain('jdoe');
    expect(output).toContain('jane@example.com');
  });

  test('handles empty users list', () => {
    const output = formatUsersTable([]);

    expect(output).toContain('User ID (user_id)');
    expect(output).toContain('Email (mail)');
  });
});

describe('formatGroupsTable', () => {
  test('formats groups as table', () => {
    const groups: Group[] = [
      {
        id: 1,
        creationDate: '2024-01-01',
        uuid: 'uuid-1',
        displayName: 'admins',
      },
      {
        id: 2,
        creationDate: '2024-01-02',
        uuid: 'uuid-2',
        displayName: 'users',
      },
    ];

    const output = formatGroupsTable(groups);

    expect(output).toContain('Group ID');
    expect(output).toContain('Creation date');
    expect(output).toContain('UUID');
    expect(output).toContain('Display Name');
    expect(output).toContain('admins');
    expect(output).toContain('users');
  });
});

describe('formatSchemaAttributesTable', () => {
  test('formats schema attributes as table', () => {
    const attributes: SchemaAttribute[] = [
      {
        name: 'email',
        attributeType: 'STRING',
        isList: false,
        isVisible: true,
        isEditable: true,
      },
      {
        name: 'mailAliases',
        attributeType: 'STRING',
        isList: true,
        isVisible: true,
        isEditable: false,
      },
    ];

    const output = formatSchemaAttributesTable(attributes);

    expect(output).toContain('Name');
    expect(output).toContain('Type');
    expect(output).toContain('Is list');
    expect(output).toContain('Is visible');
    expect(output).toContain('Is editable');
    expect(output).toContain('email');
    expect(output).toContain('STRING');
    expect(output).toContain('true');
    expect(output).toContain('false');
  });
});

describe('formatList', () => {
  test('formats items as newline-separated list', () => {
    const items = ['item1', 'item2', 'item3'];
    const output = formatList(items);

    expect(output).toBe('item1\nitem2\nitem3');
  });

  test('handles empty list', () => {
    const output = formatList([]);
    expect(output).toBe('');
  });

  test('handles single item', () => {
    const output = formatList(['single']);
    expect(output).toBe('single');
  });
});
