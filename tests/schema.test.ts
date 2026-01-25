import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LldapClient } from '../src/client';
import { SchemaService } from '../src/schema';
import type { Config } from '../src/types';
import { createMockFetch, createTestToken } from './test-utils';

const originalFetch = globalThis.fetch;

describe('SchemaService', () => {
  const mockConfig: Config = {
    httpUrl: 'http://localhost:17170',
    username: 'admin',
    token: createTestToken(),
    endpoints: {
      auth: '/auth/simple/login',
      graphql: '/api/graphql',
      logout: '/auth/logout',
      refresh: '/auth/refresh',
    },
  };

  const mockUserAttributes = [
    {
      name: 'email',
      attributeType: 'STRING',
      isList: false,
      isVisible: true,
      isEditable: true,
    },
    {
      name: 'mailAlias',
      attributeType: 'STRING',
      isList: true,
      isVisible: true,
      isEditable: false,
    },
  ];

  const mockGroupAttributes = [
    {
      name: 'description',
      attributeType: 'STRING',
      isList: false,
      isVisible: true,
      isEditable: true,
    },
  ];

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function setupMockFetch(responseData: unknown) {
    globalThis.fetch = createMockFetch(async () => {
      return new Response(JSON.stringify({
        data: responseData,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  }

  // User Attributes Tests
  describe('User Attributes', () => {
    test('getUserAttributes returns attribute list', async () => {
      setupMockFetch({
        schema: {
          userSchema: { attributes: mockUserAttributes },
        },
      });

      const client = new LldapClient(mockConfig);
      const schemaService = new SchemaService(client);
      const attributes = await schemaService.getUserAttributes();

      expect(attributes).toHaveLength(2);
      expect(attributes[0].name).toBe('email');
      expect(attributes[1].name).toBe('mailAlias');
    });

    test('getUserAttributeType returns correct type', async () => {
      setupMockFetch({
        schema: {
          userSchema: { attributes: mockUserAttributes },
        },
      });

      const client = new LldapClient(mockConfig);
      const schemaService = new SchemaService(client);
      const type = await schemaService.getUserAttributeType('email');

      expect(type).toBe('STRING');
    });

    test('getUserAttributeType throws for unknown attribute', async () => {
      setupMockFetch({
        schema: {
          userSchema: { attributes: mockUserAttributes },
        },
      });

      const client = new LldapClient(mockConfig);
      const schemaService = new SchemaService(client);

      await expect(schemaService.getUserAttributeType('unknown')).rejects.toThrow(
        'Attribute unknown is not part of user schema.'
      );
    });

    test('isUserAttributeList returns correct value', async () => {
      setupMockFetch({
        schema: {
          userSchema: { attributes: mockUserAttributes },
        },
      });

      const client = new LldapClient(mockConfig);
      const schemaService = new SchemaService(client);

      expect(await schemaService.isUserAttributeList('email')).toBe(false);
      expect(await schemaService.isUserAttributeList('mailAlias')).toBe(true);
    });

    test('addUserAttribute sends correct mutation', async () => {
      let capturedBody = '';
      globalThis.fetch = createMockFetch(async (_url: string, options?: RequestInit) => {
        capturedBody = options?.body as string;
        return new Response(JSON.stringify({
          data: { addUserAttribute: { ok: true } },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient(mockConfig);
      const schemaService = new SchemaService(client);
      await schemaService.addUserAttribute('newAttr', 'STRING', {
        isList: true,
        isVisible: true,
        isEditable: false,
      });

      const body = JSON.parse(capturedBody);
      expect(body.variables.name).toBe('newAttr');
      expect(body.variables.type).toBe('STRING');
      expect(body.variables.isList).toBe(true);
      expect(body.variables.isVisible).toBe(true);
      expect(body.variables.isEditable).toBe(false);
    });

    test('deleteUserAttribute sends correct mutation', async () => {
      let capturedBody = '';
      globalThis.fetch = createMockFetch(async (_url: string, options?: RequestInit) => {
        capturedBody = options?.body as string;
        return new Response(JSON.stringify({
          data: { deleteUserAttribute: { ok: true } },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient(mockConfig);
      const schemaService = new SchemaService(client);
      await schemaService.deleteUserAttribute('oldAttr');

      const body = JSON.parse(capturedBody);
      expect(body.variables.name).toBe('oldAttr');
    });
  });

  // Group Attributes Tests
  describe('Group Attributes', () => {
    test('getGroupAttributes returns attribute list', async () => {
      setupMockFetch({
        schema: {
          groupSchema: { attributes: mockGroupAttributes },
        },
      });

      const client = new LldapClient(mockConfig);
      const schemaService = new SchemaService(client);
      const attributes = await schemaService.getGroupAttributes();

      expect(attributes).toHaveLength(1);
      expect(attributes[0].name).toBe('description');
    });

    test('addGroupAttribute sends correct mutation', async () => {
      let capturedBody = '';
      globalThis.fetch = createMockFetch(async (_url: string, options?: RequestInit) => {
        capturedBody = options?.body as string;
        return new Response(JSON.stringify({
          data: { addGroupAttribute: { ok: true } },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient(mockConfig);
      const schemaService = new SchemaService(client);
      await schemaService.addGroupAttribute('groupAttr', 'INTEGER');

      const body = JSON.parse(capturedBody);
      expect(body.variables.name).toBe('groupAttr');
      expect(body.variables.type).toBe('INTEGER');
    });
  });

  // Object Classes Tests
  describe('Object Classes', () => {
    test('listUserObjectClasses returns class list', async () => {
      setupMockFetch({
        schema: {
          userSchema: {
            extraLdapObjectClasses: ['inetOrgPerson', 'posixAccount'],
          },
        },
      });

      const client = new LldapClient(mockConfig);
      const schemaService = new SchemaService(client);
      const classes = await schemaService.listUserObjectClasses();

      expect(classes).toEqual(['inetOrgPerson', 'posixAccount']);
    });

    test('addUserObjectClass sends correct mutation', async () => {
      let capturedBody = '';
      globalThis.fetch = createMockFetch(async (_url: string, options?: RequestInit) => {
        capturedBody = options?.body as string;
        return new Response(JSON.stringify({
          data: { addUserObjectClass: { ok: true } },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const client = new LldapClient(mockConfig);
      const schemaService = new SchemaService(client);
      await schemaService.addUserObjectClass('newClass');

      const body = JSON.parse(capturedBody);
      expect(body.variables.name).toBe('newClass');
    });

    test('listGroupObjectClasses returns class list', async () => {
      setupMockFetch({
        schema: {
          groupSchema: {
            extraLdapObjectClasses: ['posixGroup'],
          },
        },
      });

      const client = new LldapClient(mockConfig);
      const schemaService = new SchemaService(client);
      const classes = await schemaService.listGroupObjectClasses();

      expect(classes).toEqual(['posixGroup']);
    });
  });
});
