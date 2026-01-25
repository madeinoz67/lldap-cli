import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { LldapClient } from '../src/client';
import { UserService } from '../src/users';
import type { Config } from '../src/types';
import { createMockFetch, createTestToken } from './test-utils';

const originalFetch = globalThis.fetch;

describe('UserService', () => {
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

  const mockUsers = [
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

  test('getUsers returns user list', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const users = await userService.getUsers();

    expect(users).toHaveLength(2);
    expect(users[0].id).toBe('jsmith');
    expect(users[1].id).toBe('jdoe');
  });

  test('listUserIds returns only IDs', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const ids = await userService.listUserIds();

    expect(ids).toEqual(['jsmith', 'jdoe']);
  });

  test('listUserEmails returns sorted emails', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const emails = await userService.listUserEmails();

    expect(emails).toEqual(['jane@example.com', 'john@example.com']);
  });

  test('getUserIdByEmail finds user', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const userId = await userService.getUserIdByEmail('john@example.com');

    expect(userId).toBe('jsmith');
  });

  test('getUserIdByEmail returns null for unknown email', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const userId = await userService.getUserIdByEmail('unknown@example.com');

    expect(userId).toBeNull();
  });

  test('resolveUserId returns ID for email', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const userId = await userService.resolveUserId('john@example.com');

    expect(userId).toBe('jsmith');
  });

  test('resolveUserId returns ID as-is for non-email', async () => {
    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const userId = await userService.resolveUserId('jsmith');

    expect(userId).toBe('jsmith');
  });

  test('resolveUserId throws for unknown email', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);

    await expect(userService.resolveUserId('unknown@example.com')).rejects.toThrow(
      'No user found with email: unknown@example.com'
    );
  });

  test('getUserGroups returns group names', async () => {
    setupMockFetch({
      user: {
        groups: [{ displayName: 'admins' }, { displayName: 'users' }],
      },
    });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const groups = await userService.getUserGroups('jsmith');

    expect(groups).toEqual(['admins', 'users']);
  });

  test('listUserAttributes returns sorted attribute names', async () => {
    setupMockFetch({
      user: {
        attributes: [{ name: 'email' }, { name: 'avatar' }, { name: 'displayName' }],
      },
    });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const attributes = await userService.listUserAttributes('jsmith');

    expect(attributes).toEqual(['avatar', 'displayName', 'email']);
  });

  test('getUserAttributeValues returns values for attribute', async () => {
    setupMockFetch({
      user: {
        attributes: [
          { name: 'email', value: ['john@example.com'] },
          { name: 'mailAlias', value: ['johnny@example.com', 'jsmith@example.com'] },
        ],
      },
    });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const values = await userService.getUserAttributeValues('jsmith', 'mailAlias');

    expect(values).toEqual(['johnny@example.com', 'jsmith@example.com']);
  });

  test('createUser sends correct mutation', async () => {
    let capturedBody = '';
    globalThis.fetch = createMockFetch(async (_url: string, options?: RequestInit) => {
      capturedBody = options?.body as string;
      return new Response(JSON.stringify({
        data: {
          createUser: {
            id: 'newuser',
            email: 'new@example.com',
            displayName: 'New User',
            firstName: '',
            lastName: '',
            avatar: '',
          },
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    await userService.createUser('newuser', 'new@example.com', {
      displayName: 'New User',
    });

    const body = JSON.parse(capturedBody);
    expect(body.variables.user.id).toBe('newuser');
    expect(body.variables.user.email).toBe('new@example.com');
    expect(body.variables.user.displayName).toBe('New User');
  });

  test('deleteUser sends correct mutation', async () => {
    let capturedBody = '';
    globalThis.fetch = createMockFetch(async (_url: string, options?: RequestInit) => {
      capturedBody = options?.body as string;
      return new Response(JSON.stringify({
        data: { deleteUser: { ok: true } },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    await userService.deleteUser('jsmith');

    const body = JSON.parse(capturedBody);
    expect(body.variables.userId).toBe('jsmith');
  });

  test('searchUsers matches by uid', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const users = await userService.searchUsers('jsmith');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('jsmith');
  });

  test('searchUsers matches by email', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const users = await userService.searchUsers('jane@example.com');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('jdoe');
  });

  test('searchUsers matches by display name', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const users = await userService.searchUsers('John Smith');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('jsmith');
  });

  test('searchUsers supports wildcard *', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const users = await userService.searchUsers('j*');

    expect(users).toHaveLength(2);
  });

  test('searchUsers supports wildcard ?', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const users = await userService.searchUsers('jdo?');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('jdoe');
  });

  test('searchUsers is case insensitive', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const users = await userService.searchUsers('JSMITH');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('jsmith');
  });

  test('searchUsers returns empty for no matches', async () => {
    setupMockFetch({ users: mockUsers });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const users = await userService.searchUsers('nonexistent');

    expect(users).toHaveLength(0);
  });

  test('getUsersByGroup filters by group membership', async () => {
    const usersWithGroups = [
      { ...mockUsers[0], groups: [{ displayName: 'admins' }] },
      { ...mockUsers[1], groups: [{ displayName: 'users' }] },
    ];
    setupMockFetch({ users: usersWithGroups });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const users = await userService.getUsersByGroup('admins');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('jsmith');
  });

  test('getUsersByGroup is case insensitive', async () => {
    const usersWithGroups = [
      { ...mockUsers[0], groups: [{ displayName: 'Admins' }] },
      { ...mockUsers[1], groups: [{ displayName: 'users' }] },
    ];
    setupMockFetch({ users: usersWithGroups });

    const client = new LldapClient(mockConfig);
    const userService = new UserService(client);
    const users = await userService.getUsersByGroup('ADMINS');

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('jsmith');
  });
});
