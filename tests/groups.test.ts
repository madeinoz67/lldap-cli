import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LldapClient } from '../src/client';
import { GroupService } from '../src/groups';
import type { Config } from '../src/types';
import { createMockFetch, createTestToken } from './test-utils';

const originalFetch = globalThis.fetch;

describe('GroupService', () => {
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

  const mockGroups = [
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

  test('getGroups returns group list', async () => {
    setupMockFetch({ groups: mockGroups });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);
    const groups = await groupService.getGroups();

    expect(groups).toHaveLength(2);
    expect(groups[0].displayName).toBe('admins');
    expect(groups[1].displayName).toBe('users');
  });

  test('getGroupId finds group by name', async () => {
    setupMockFetch({ groups: mockGroups });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);
    const id = await groupService.getGroupId('admins');

    expect(id).toBe(1);
  });

  test('getGroupId throws for unknown group', async () => {
    setupMockFetch({ groups: mockGroups });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);

    await expect(groupService.getGroupId('unknown')).rejects.toThrow(
      'Failed to retrieve group ID for group: unknown'
    );
  });

  test('listUserIdsByGroupName returns user IDs', async () => {
    let callCount = 0;
    globalThis.fetch = createMockFetch(async () => {
      callCount++;
      if (callCount === 1) {
        // First call: get groups
        return new Response(JSON.stringify({
          data: { groups: mockGroups },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Second call: get users in group
      return new Response(JSON.stringify({
        data: {
          group: {
            users: [{ id: 'jsmith' }, { id: 'jdoe' }],
          },
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);
    const userIds = await groupService.listUserIdsByGroupName('admins');

    expect(userIds).toEqual(['jsmith', 'jdoe']);
  });

  test('listGroupAttributes returns sorted attribute names', async () => {
    setupMockFetch({
      group: {
        attributes: [{ name: 'description' }, { name: 'alias' }],
      },
    });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);
    const attributes = await groupService.listGroupAttributes(1);

    expect(attributes).toEqual(['alias', 'description']);
  });

  test('createGroup sends correct mutation', async () => {
    let capturedBody = '';
    globalThis.fetch = createMockFetch(async (_url: string, options?: RequestInit) => {
      capturedBody = options?.body as string;
      return new Response(JSON.stringify({
        data: { createGroup: { id: 3 } },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);
    await groupService.createGroup('newgroup');

    const body = JSON.parse(capturedBody);
    expect(body.variables.group).toBe('newgroup');
  });

  test('deleteGroup sends correct mutation', async () => {
    let callCount = 0;
    let capturedBody = '';

    globalThis.fetch = createMockFetch(async (_url: string, options?: RequestInit) => {
      callCount++;
      if (callCount === 1) {
        // First call: get groups to find ID
        return new Response(JSON.stringify({
          data: { groups: mockGroups },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Second call: delete group
      capturedBody = options?.body as string;
      return new Response(JSON.stringify({
        data: { deleteGroup: { ok: true } },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);
    await groupService.deleteGroup('admins');

    const body = JSON.parse(capturedBody);
    expect(body.variables.id).toBe(1);
  });

  test('searchGroups matches by display name', async () => {
    setupMockFetch({ groups: mockGroups });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);
    const groups = await groupService.searchGroups('admins');

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe('admins');
  });

  test('searchGroups supports wildcard *', async () => {
    setupMockFetch({ groups: mockGroups });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);
    const groups = await groupService.searchGroups('*s');

    expect(groups).toHaveLength(2);
  });

  test('searchGroups supports wildcard ?', async () => {
    setupMockFetch({ groups: mockGroups });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);
    const groups = await groupService.searchGroups('user?');

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe('users');
  });

  test('searchGroups is case insensitive', async () => {
    setupMockFetch({ groups: mockGroups });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);
    const groups = await groupService.searchGroups('ADMINS');

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe('admins');
  });

  test('searchGroups returns empty for no matches', async () => {
    setupMockFetch({ groups: mockGroups });

    const client = new LldapClient(mockConfig);
    const groupService = new GroupService(client);
    const groups = await groupService.searchGroups('nonexistent');

    expect(groups).toHaveLength(0);
  });
});
