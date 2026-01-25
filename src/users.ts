import type { LldapClient } from './client';
import type { User, Attribute, MutationType, SchemaAttribute } from './types';

interface UsersData {
  users: User[];
}

interface UserData {
  user: User & { groups: Array<{ displayName: string }>; attributes: Attribute[] };
}

interface UserAttributeData {
  user: { attributes: Array<{ name: string; value: string[] }> };
}

interface SchemaData {
  schema: {
    userSchema: {
      attributes: SchemaAttribute[];
    };
  };
}

export class UserService {
  constructor(private client: LldapClient) {}

  /**
   * Get all users
   */
  async getUsers(): Promise<User[]> {
    const query = '{users{id creationDate uuid email displayName firstName lastName}}';
    const data = await this.client.query<UsersData>(query);
    return data.users;
  }

  /**
   * List user IDs
   */
  async listUserIds(): Promise<string[]> {
    const users = await this.getUsers();
    return users.map((u) => u.id);
  }

  /**
   * List user emails
   */
  async listUserEmails(): Promise<string[]> {
    const users = await this.getUsers();
    return users.map((u) => u.email).sort();
  }

  /**
   * Search users by pattern (matches uid, email, or display name)
   * Supports glob-style wildcards (* and ?)
   */
  async searchUsers(pattern: string): Promise<User[]> {
    const users = await this.getUsers();
    const regex = this.globToRegex(pattern);
    return users.filter(
      (u) =>
        regex.test(u.id) ||
        regex.test(u.email) ||
        regex.test(u.displayName || '')
    );
  }

  /**
   * Get users filtered by group membership
   */
  async getUsersByGroup(groupName: string): Promise<User[]> {
    // Get all users with their groups
    const query = '{users{id creationDate uuid email displayName firstName lastName groups{displayName}}}';
    const data = await this.client.query<{ users: Array<User & { groups: Array<{ displayName: string }> }> }>(query);
    return data.users
      .filter((u) => u.groups.some((g) => g.displayName.toLowerCase() === groupName.toLowerCase()))
      .map(({ groups, ...user }) => user);
  }

  /**
   * Convert glob pattern to regex
   */
  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
      .replace(/\*/g, '.*')                    // * -> .*
      .replace(/\?/g, '.');                    // ? -> .
    return new RegExp(`^${escaped}$`, 'i');    // Case insensitive, full match
  }

  /**
   * Get user ID by email
   */
  async getUserIdByEmail(email: string): Promise<string | null> {
    const users = await this.getUsers();
    const user = users.find((u) => u.email === email);
    return user?.id || null;
  }

  /**
   * Resolve a user identifier (email or ID) to a user ID
   */
  async resolveUserId(identifier: string): Promise<string> {
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (emailRegex.test(identifier)) {
      const userId = await this.getUserIdByEmail(identifier);
      if (!userId) {
        throw new Error(`No user found with email: ${identifier}`);
      }
      return userId;
    }
    return identifier;
  }

  /**
   * Get groups for a user
   */
  async getUserGroups(userId: string): Promise<string[]> {
    const query = 'query getUserGroups($id:String!){user(userId:$id){groups{displayName}}}';
    const data = await this.client.query<UserData>(query, { id: userId });
    return data.user.groups.map((g) => g.displayName);
  }

  /**
   * List user attributes
   */
  async listUserAttributes(userId: string): Promise<string[]> {
    const query = 'query getUserInfo($id:String!){user(userId:$id){attributes{name}}}';
    const data = await this.client.query<UserAttributeData>(query, { id: userId });
    return data.user.attributes.map((a) => a.name).sort();
  }

  /**
   * Get user attribute values
   */
  async getUserAttributeValues(userId: string, attribute: string): Promise<string[]> {
    const query = 'query getUserInfo($id:String!){user(userId:$id){attributes{name,value}}}';
    const data = await this.client.query<UserAttributeData>(query, { id: userId });
    const attr = data.user.attributes.find((a) => a.name === attribute);
    return attr?.value || [];
  }

  /**
   * Create a new user
   */
  async createUser(
    id: string,
    email: string,
    options: {
      displayName?: string;
      firstName?: string;
      lastName?: string;
      avatar?: string;
    } = {}
  ): Promise<void> {
    // Validate inputs with length limits
    this.client.validateUsername(id);
    this.client.validateEmail(email);
    if (options.displayName) this.client.validateStringInput(options.displayName, 'displayName');
    if (options.firstName) this.client.validateStringInput(options.firstName, 'firstName');
    if (options.lastName) this.client.validateStringInput(options.lastName, 'lastName');

    const query = `mutation createUser($user:CreateUserInput!){
      createUser(user:$user){id email displayName firstName lastName avatar}
    }`;

    const variables = {
      user: {
        id,
        email,
        displayName: options.displayName || '',
        firstName: options.firstName || '',
        lastName: options.lastName || '',
        avatar: options.avatar || '',
      },
    };

    await this.client.query(query, variables, options.avatar);
    console.log(`Created user: ${id}`);
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<void> {
    const query = 'mutation deleteUser($userId:String!){deleteUser(userId:$userId){ok}}';
    const data = await this.client.query<{ deleteUser: { ok: boolean } }>(query, { userId });
    if (data.deleteUser.ok) {
      console.log(`Deleted user: ${userId}`);
    } else {
      throw new Error(`Failed to delete user: ${userId}`);
    }
  }

  /**
   * Get schema info for a user attribute
   */
  private async getSchemaAttribute(attribute: string): Promise<SchemaAttribute | null> {
    const query = '{schema{userSchema{attributes{name,attributeType,isList,isVisible,isEditable}}}}';
    const data = await this.client.query<SchemaData>(query);
    return data.schema.userSchema.attributes.find((a) => a.name === attribute) || null;
  }

  /**
   * Update a user attribute
   */
  async updateUserAttribute(
    mutation: MutationType,
    userId: string,
    attribute: string,
    value?: string
  ): Promise<void> {
    const schemaAttr = await this.getSchemaAttribute(attribute);
    if (!schemaAttr) {
      throw new Error(`Attribute ${attribute} is not part of user schema.`);
    }

    const isList = schemaAttr.isList;

    // Validate mutation type vs attribute type
    if (mutation === 'set' && isList) {
      throw new Error(`Attribute ${attribute} is a list and cannot be modified using the ${mutation} mutation.`);
    }
    if ((mutation === 'add' || mutation === 'del') && !isList) {
      throw new Error(`Attribute ${attribute} is not a list and cannot be modified using the ${mutation} mutation.`);
    }

    const query = 'mutation updateUser($user:UpdateUserInput!){updateUser(user:$user){ok}}';
    let variables: Record<string, unknown>;
    let resultLine: string;

    switch (mutation) {
      case 'set':
        variables = {
          user: {
            id: userId,
            insertAttributes: { name: attribute, value: value || '' },
          },
        };
        resultLine = `Attribute set for user: ${userId}, attribute: ${attribute}`;
        if (value && schemaAttr.attributeType !== 'JPEG_PHOTO') {
          resultLine += `, value: ${value}`;
        }
        break;

      case 'clear': {
        const currentValues = await this.getUserAttributeValues(userId, attribute);
        if (currentValues.length === 0) {
          throw new Error(`Attribute ${attribute} has no value set for user ${userId}, so nothing to clear.`);
        }
        variables = {
          user: {
            id: userId,
            removeAttributes: attribute,
          },
        };
        resultLine = `Attribute cleared for user: ${userId}, attribute: ${attribute}`;
        break;
      }

      case 'add': {
        if (!value) {
          throw new Error('Value is required for add mutation');
        }
        const currentValues = await this.getUserAttributeValues(userId, attribute);
        const newValues = [...currentValues, value];
        variables = {
          user: {
            id: userId,
            insertAttributes: { name: attribute, value: newValues },
          },
        };
        resultLine = `Attribute list value added for user: ${userId}, attribute: ${attribute}, value: ${value}`;
        break;
      }

      case 'del': {
        if (!value) {
          throw new Error('Value is required for del mutation');
        }
        const currentValues = await this.getUserAttributeValues(userId, attribute);
        if (!currentValues.includes(value)) {
          throw new Error(`Attribute ${attribute} has no listed value ${value} for user ${userId}, so no value to delete.`);
        }
        const newValues = currentValues.filter((v) => v !== value);
        if (newValues.length === 0) {
          // Clear the entire attribute
          return this.updateUserAttribute('clear', userId, attribute);
        }
        variables = {
          user: {
            id: userId,
            insertAttributes: { name: attribute, value: newValues },
          },
        };
        resultLine = `Attribute list value deleted for user: ${userId}, attribute: ${attribute}, value: ${value}`;
        break;
      }

      default:
        throw new Error(`Unknown mutation type: ${mutation}`);
    }

    await this.client.query(query, variables);
    console.log(resultLine);
  }

  /**
   * Validate input to prevent command injection
   */
  private validateInput(value: string, fieldName: string): void {
    // Reject any characters that could be used for shell injection
    const dangerousChars = /[;&|`$()<>\\"\n\r\t\0]/;
    if (dangerousChars.test(value)) {
      throw new Error(`Invalid ${fieldName}: contains potentially dangerous characters`);
    }
    // Reject empty or whitespace-only values
    if (!value || value.trim().length === 0) {
      throw new Error(`Invalid ${fieldName}: cannot be empty`);
    }
  }

  /**
   * Validate password meets security requirements
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('New password is too short, expected at least 8 characters');
    }
    if (password.length > 128) {
      throw new Error('New password is too long, maximum 128 characters');
    }
    // Check for at least some complexity
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      throw new Error('Password must contain at least one letter and one number');
    }
  }

  /**
   * Set user password using lldap_set_password (requires the tool to be installed)
   */
  async setPassword(userId: string, password: string, httpUrl: string, token: string): Promise<void> {
    // Validate all inputs to prevent command injection
    this.validateInput(userId, 'userId');
    this.validatePassword(password);
    this.validateInput(httpUrl, 'httpUrl');
    this.validateInput(token, 'token');

    // Pass password via stdin to avoid exposing in process arguments
    const proc = Bun.spawn(['lldap_set_password', '-b', httpUrl, `--token=${token}`, '-u', userId], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    // Write password to stdin and close
    // Bun's stdin is a FileSink when using 'pipe'
    const stdin = proc.stdin as { write(data: Uint8Array): number; end(): void };
    stdin.write(new TextEncoder().encode(password + '\n'));
    stdin.end();

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      // Sanitize error message to avoid leaking sensitive info
      const sanitizedError = stderr.replace(/token[=:]\S+/gi, 'token=[REDACTED]');
      throw new Error(`Failed to set password: ${sanitizedError}`);
    }
  }

  /**
   * Add user to a group
   */
  async addToGroup(userId: string, groupId: number): Promise<void> {
    const query = 'mutation addUserToGroup($userId:String!,$groupId:Int!){addUserToGroup(userId:$userId,groupId:$groupId){ok}}';
    await this.client.query(query, { userId, groupId });
  }

  /**
   * Remove user from a group
   */
  async removeFromGroup(userId: string, groupId: number): Promise<void> {
    const query = 'mutation removeUserFromGroup($userId:String!,$groupId:Int!){removeUserFromGroup(userId:$userId,groupId:$groupId){ok}}';
    await this.client.query(query, { userId, groupId });
  }
}
