#!/usr/bin/env bun

import { existsSync, readFileSync } from 'fs';
import { Command } from 'commander';
import { buildConfig } from './config';
import { LldapClient } from './client';
import { UserService } from './users';
import { GroupService } from './groups';
import { SchemaService } from './schema';
import {
  formatUsersTable,
  formatGroupsTable,
  formatSchemaAttributesTable,
  formatList,
} from './formatters';
import type { Config, MutationType, AttributeType } from './types';

// Load .env file if it exists (Bun doesn't auto-load .env in all cases)
function loadEnvFile(): void {
  const envPath = '.env';
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        // Don't override existing environment variables
        if (!process.env[key.trim()]) {
          // Remove surrounding quotes if present
          const cleanValue = value.trim().replace(/^["']|["']$/g, '');
          process.env[key.trim()] = cleanValue;
        }
      }
    }
  }
}

// Load .env at startup
loadEnvFile();

const program = new Command();

// Global options storage
let globalOptions: Partial<Config> = {};

program
  .name('lldap-cli')
  .description('CLI tool for managing LLDAP (Lightweight LDAP) users, groups, and schema')
  .version('1.0.1')
  .option('-H, --http-url <url>', 'HTTP base URL of the LLDAP management interface')
  .option('-D, --username <username>', 'Username of the admin account')
  .option('-t, --token <token>', 'Authentication token (prefer LLDAP_TOKEN env var)')
  .option('-r, --refresh-token <token>', 'Refresh token (prefer LLDAP_REFRESHTOKEN env var)')
  .option('--debug', 'Enable debug output (WARNING: may expose sensitive info in logs)')
  .hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    globalOptions = {
      httpUrl: opts.httpUrl,
      username: opts.username,
      // Password must come from prompt or environment variable, never CLI argument
      token: opts.token,
      refreshToken: opts.refreshToken,
    };

    // Enable debug mode if requested (with warning)
    if (opts.debug) {
      console.error('WARNING: Debug mode enabled. Output may contain sensitive information.');
      console.error('Do not use in production or share debug output publicly.');
      LldapClient.setDebugEnabled(true);
    }
  });

// ============ LOGIN ============

program
  .command('login')
  .description('Authenticate and print tokens for subsequent commands')
  .option('-W, --prompt-password', 'Prompt for password (recommended over environment variable)')
  .option('-w, --password <password>', 'Password (prefer -W or LLDAP_PASSWORD env var)')
  .option('-o, --output <file>', 'Write tokens to file instead of stdout (more secure)')
  .option('-q, --quiet', 'Suppress security warnings')
  .action(async (opts) => {
    try {
      // Handle password from login command options
      if (opts.promptPassword) {
        process.stderr.write('Login password: ');
        const pwd = await readPassword();
        if (!pwd) {
          console.error('ERROR: No password provided');
          process.exit(1);
        }
        globalOptions.password = pwd;
      } else if (opts.password) {
        globalOptions.password = opts.password;
      }

      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);

      let token: string;
      let refreshToken: string;

      if (config.refreshToken && !config.password) {
        // Refresh existing token
        token = await client.refresh();
        refreshToken = config.refreshToken;
      } else {
        // Full login
        const tokens = await client.login();
        token = tokens.token;
        refreshToken = tokens.refreshToken;
      }

      const output = `export LLDAP_TOKEN=${token}\nexport LLDAP_REFRESHTOKEN=${refreshToken}\n`;

      if (opts.output) {
        // Write to file with restricted permissions
        const fs = await import('fs');
        fs.writeFileSync(opts.output, output, { mode: 0o600 });
        console.error(`Tokens written to ${opts.output} (mode 600)`);
        console.error(`Source with: source ${opts.output}`);
      } else {
        if (!opts.quiet) {
          console.error('WARNING: Tokens will be displayed. Consider using -o <file> for better security.');
          console.error('Suppress this warning with -q or --quiet');
        }
        console.log(output.trim());
      }
    } catch (error) {
      handleError(error);
    }
  });

// ============ LOGOUT ============

program
  .command('logout')
  .description('Invalidate refresh token and associated tokens')
  .action(async () => {
    try {
      const config = buildConfig(globalOptions);
      if (!config.refreshToken) {
        console.error('ERROR: A refresh token is not available for logout.');
        process.exit(1);
      }

      const client = new LldapClient(config);
      await client.logout();
      console.log('unset LLDAP_TOKEN');
      console.log('unset LLDAP_REFRESHTOKEN');
      console.error('Refresh token and any associated tokens are invalidated.');
    } catch (error) {
      handleError(error);
    }
  });

// ============ USER COMMANDS ============

const userCommand = program.command('user').description('User management commands');

userCommand
  .command('list [field]')
  .description('List users (field: uid or email)')
  .action(async (field = 'uid') => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const userService = new UserService(client);

      let output: string;
      if (field === 'uid') {
        output = formatList(await userService.listUserIds());
      } else if (field === 'email') {
        output = formatList(await userService.listUserEmails());
      } else {
        const users = await userService.getUsers();
        output = formatUsersTable(users);
      }

      console.log(output);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

userCommand
  .command('add <uid> <email>')
  .description('Create a new user')
  .option('-P, --prompt-password', 'Prompt for user password (recommended)')
  .option('-d, --display-name <name>', 'Display name')
  .option('-f, --first-name <name>', 'First name')
  .option('-l, --last-name <name>', 'Last name')
  .option('-a, --avatar <file>', 'Avatar image file')
  .action(async (uid, email, opts) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const userService = new UserService(client);

      // Password must come from prompt, never CLI argument
      let userPassword: string | undefined;
      if (opts.promptPassword) {
        process.stdout.write('New user password: ');
        userPassword = await readPassword();
      }

      await userService.createUser(uid, email, {
        displayName: opts.displayName,
        firstName: opts.firstName,
        lastName: opts.lastName,
        avatar: opts.avatar,
      });

      if (userPassword) {
        const token = client.getToken();
        if (token) {
          await userService.setPassword(uid, userPassword, config.httpUrl, token);
        }
      }

      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

userCommand
  .command('del <uid>')
  .description('Delete a user')
  .action(async (uid) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const userService = new UserService(client);

      const resolvedUid = await userService.resolveUserId(uid);
      await userService.deleteUser(resolvedUid);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

userCommand
  .command('update <mutation> <uid> <attribute> [value]')
  .description('Update a user attribute (mutation: set, clear, add, del)')
  .action(async (mutation, uid, attribute, value) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const userService = new UserService(client);

      const resolvedUid = await userService.resolveUserId(uid);

      if (attribute === 'password') {
        if (mutation !== 'set') {
          console.error(`ERROR: Mutation ${mutation} not supported for attribute password. Use set instead.`);
          process.exit(1);
        }
        let password = value;
        if (!password) {
          process.stdout.write('New user password: ');
          password = await readPassword();
        }
        const token = client.getToken();
        if (token) {
          await userService.setPassword(resolvedUid, password, config.httpUrl, token);
        }
      } else {
        await userService.updateUserAttribute(mutation as MutationType, resolvedUid, attribute, value);
      }

      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

userCommand
  .command('info [uid]')
  .description('Show user information')
  .action(async (uid) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const userService = new UserService(client);

      const users = await userService.getUsers();

      if (uid) {
        const resolvedUid = await userService.resolveUserId(uid);
        const filteredUsers = users.filter((u) => u.id === resolvedUid);
        console.log(formatUsersTable(filteredUsers));
      } else {
        console.log(formatUsersTable(users));
      }

      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

// User attribute subcommands
const userAttributeCommand = userCommand.command('attribute').description('User attribute commands');

userAttributeCommand
  .command('list <uid>')
  .description('List attributes for a user')
  .action(async (uid) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const userService = new UserService(client);

      const resolvedUid = await userService.resolveUserId(uid);
      const attributes = await userService.listUserAttributes(resolvedUid);
      console.log(formatList(attributes));
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

userAttributeCommand
  .command('values <uid> <attribute>')
  .description('Get values for a user attribute')
  .action(async (uid, attribute) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const userService = new UserService(client);

      const resolvedUid = await userService.resolveUserId(uid);
      const values = await userService.getUserAttributeValues(resolvedUid, attribute);
      console.log(formatList(values));
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

// User group subcommands
const userGroupCommand = userCommand.command('group').description('User group membership commands');

userGroupCommand
  .command('add <uid> <groupName>')
  .description('Add user to a group')
  .action(async (uid, groupName) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const userService = new UserService(client);
      const groupService = new GroupService(client);

      const resolvedUid = await userService.resolveUserId(uid);
      const groupId = await groupService.getGroupId(groupName);
      await userService.addToGroup(resolvedUid, groupId);
      console.log(`Added user ${resolvedUid} to group ${groupName}`);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

userGroupCommand
  .command('del <uid> <groupName>')
  .description('Remove user from a group')
  .action(async (uid, groupName) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const userService = new UserService(client);
      const groupService = new GroupService(client);

      const resolvedUid = await userService.resolveUserId(uid);
      const groupId = await groupService.getGroupId(groupName);
      await userService.removeFromGroup(resolvedUid, groupId);
      console.log(`Removed user ${resolvedUid} from group ${groupName}`);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

userGroupCommand
  .command('list <uid>')
  .description('List groups for a user')
  .action(async (uid) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const userService = new UserService(client);

      const resolvedUid = await userService.resolveUserId(uid);
      const groups = await userService.getUserGroups(resolvedUid);
      console.log(formatList(groups));
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

// ============ GROUP COMMANDS ============

const groupCommand = program.command('group').description('Group management commands');

groupCommand
  .command('list')
  .description('List all groups')
  .action(async () => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const groupService = new GroupService(client);

      const groups = await groupService.getGroups();
      console.log(formatGroupsTable(groups));
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

groupCommand
  .command('add <name>')
  .description('Create a new group')
  .action(async (name) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const groupService = new GroupService(client);

      await groupService.createGroup(name);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

groupCommand
  .command('del <name>')
  .description('Delete a group')
  .action(async (name) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const groupService = new GroupService(client);

      await groupService.deleteGroup(name);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

groupCommand
  .command('update <mutation> <name> <attribute> [value]')
  .description('Update a group attribute (mutation: set, clear, add, del)')
  .action(async (mutation, name, attribute, value) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const groupService = new GroupService(client);

      await groupService.updateGroupAttribute(mutation as MutationType, name, attribute, value);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

groupCommand
  .command('info <name>')
  .description('List users in a group')
  .action(async (name) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const groupService = new GroupService(client);

      const userIds = await groupService.listUserIdsByGroupName(name);
      console.log(formatList(userIds));
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

// Group attribute subcommands
const groupAttributeCommand = groupCommand.command('attribute').description('Group attribute commands');

groupAttributeCommand
  .command('list <name>')
  .description('List attributes for a group')
  .action(async (name) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const groupService = new GroupService(client);

      const groupId = await groupService.getGroupId(name);
      const attributes = await groupService.listGroupAttributes(groupId);
      console.log(formatList(attributes));
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

groupAttributeCommand
  .command('values <name> <attribute>')
  .description('Get values for a group attribute')
  .action(async (name, attribute) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const groupService = new GroupService(client);

      const groupId = await groupService.getGroupId(name);
      const values = await groupService.getGroupAttributeValues(groupId, attribute);
      console.log(formatList(values));
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

// ============ SCHEMA COMMANDS ============

const schemaCommand = program.command('schema').description('Schema management commands');

// Schema attribute commands
const schemaAttributeCommand = schemaCommand.command('attribute').description('Schema attribute commands');

// User schema attributes
const schemaUserCommand = schemaAttributeCommand.command('user').description('User schema attribute commands');

schemaUserCommand
  .command('list')
  .description('List user schema attributes')
  .action(async () => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      const attributes = await schemaService.getUserAttributes();
      console.log(formatSchemaAttributesTable(attributes));
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

schemaUserCommand
  .command('add <name> <type>')
  .description('Add a user schema attribute (type: string, integer, date_time, jpeg_photo)')
  .option('-l, --list', 'Attribute is a list')
  .option('-v, --visible', 'Attribute is visible')
  .option('-e, --editable', 'Attribute is editable')
  .action(async (name, type, opts) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      await schemaService.addUserAttribute(name, type.toUpperCase() as AttributeType, {
        isList: opts.list,
        isVisible: opts.visible,
        isEditable: opts.editable,
      });
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

schemaUserCommand
  .command('del <name>')
  .description('Delete a user schema attribute')
  .action(async (name) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      await schemaService.deleteUserAttribute(name);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

// Group schema attributes
const schemaGroupCommand = schemaAttributeCommand.command('group').description('Group schema attribute commands');

schemaGroupCommand
  .command('list')
  .description('List group schema attributes')
  .action(async () => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      const attributes = await schemaService.getGroupAttributes();
      console.log(formatSchemaAttributesTable(attributes));
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

schemaGroupCommand
  .command('add <name> <type>')
  .description('Add a group schema attribute (type: string, integer, date_time, jpeg_photo)')
  .option('-l, --list', 'Attribute is a list')
  .option('-v, --visible', 'Attribute is visible')
  .option('-e, --editable', 'Attribute is editable')
  .action(async (name, type, opts) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      await schemaService.addGroupAttribute(name, type.toUpperCase() as AttributeType, {
        isList: opts.list,
        isVisible: opts.visible,
        isEditable: opts.editable,
      });
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

schemaGroupCommand
  .command('del <name>')
  .description('Delete a group schema attribute')
  .action(async (name) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      await schemaService.deleteGroupAttribute(name);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

// Schema object class commands
const schemaObjectClassCommand = schemaCommand.command('objectclass').description('Schema object class commands');

// User object classes
const objectClassUserCommand = schemaObjectClassCommand.command('user').description('User object class commands');

objectClassUserCommand
  .command('list')
  .description('List user object classes')
  .action(async () => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      const classes = await schemaService.listUserObjectClasses();
      console.log(formatList(classes));
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

objectClassUserCommand
  .command('add <name>')
  .description('Add a user object class')
  .action(async (name) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      await schemaService.addUserObjectClass(name);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

objectClassUserCommand
  .command('del <name>')
  .description('Delete a user object class')
  .action(async (name) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      await schemaService.deleteUserObjectClass(name);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

// Group object classes
const objectClassGroupCommand = schemaObjectClassCommand.command('group').description('Group object class commands');

objectClassGroupCommand
  .command('list')
  .description('List group object classes')
  .action(async () => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      const classes = await schemaService.listGroupObjectClasses();
      console.log(formatList(classes));
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

objectClassGroupCommand
  .command('add <name>')
  .description('Add a group object class')
  .action(async (name) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      await schemaService.addGroupObjectClass(name);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

objectClassGroupCommand
  .command('del <name>')
  .description('Delete a group object class')
  .action(async (name) => {
    try {
      const config = buildConfig(globalOptions);
      const client = new LldapClient(config);
      const schemaService = new SchemaService(client);

      await schemaService.deleteGroupObjectClass(name);
      await client.cleanup();
    } catch (error) {
      handleError(error);
    }
  });

// ============ HELPER FUNCTIONS ============

async function readPassword(): Promise<string> {
  const { execSync } = await import('child_process');
  const fs = await import('fs');

  // Try to read from /dev/tty first (works even in subshells like eval $(...))
  // This allows interactive password entry when stdout is captured
  try {
    if (fs.existsSync('/dev/tty')) {
      // Open /dev/tty for reading - this is the controlling terminal
      const ttyFd = fs.openSync('/dev/tty', 'r');
      const ttyStream = fs.createReadStream('', { fd: ttyFd, autoClose: true });

      // Disable echo on the terminal
      execSync('stty -echo < /dev/tty', { stdio: 'pipe' });

      const readline = await import('readline');
      const rl = readline.createInterface({
        input: ttyStream,
        output: process.stderr, // Use stderr so it doesn't get captured by eval
        terminal: false,
      });

      const password = await new Promise<string>((resolve) => {
        rl.once('line', (line) => {
          rl.close();
          resolve(line);
        });
      });

      // Re-enable echo and print newline to stderr
      execSync('stty echo < /dev/tty', { stdio: 'pipe' });
      process.stderr.write('\n');

      // Close the stream and file descriptor explicitly
      ttyStream.destroy();
      try {
        fs.closeSync(ttyFd);
      } catch {
        // May already be closed by destroy
      }

      return password.trim();
    }
  } catch {
    // /dev/tty not available, fall through to other methods
    try {
      execSync('stty echo < /dev/tty', { stdio: 'pipe' });
    } catch {
      // Ignore
    }
  }

  // Fallback: Check if stdin is a TTY
  if (process.stdin.isTTY) {
    try {
      execSync('stty -echo', { stdio: 'inherit' });

      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });

      const password = await new Promise<string>((resolve) => {
        rl.once('line', (line) => {
          rl.close();
          resolve(line);
        });
      });

      execSync('stty echo', { stdio: 'inherit' });
      process.stdout.write('\n');

      return password.trim();
    } catch {
      try {
        execSync('stty echo', { stdio: 'inherit' });
      } catch {
        // Ignore
      }
      throw new Error('Failed to read password securely');
    }
  }

  // Non-interactive mode (piped input) - read from stdin
  const text = await Bun.stdin.text();
  const firstLine = text.split('\n')[0] || '';
  return firstLine.trim();
}

function handleError(error: unknown): never {
  if (error instanceof Error) {
    console.error(`ERROR: ${error.message}`);
  } else {
    console.error('ERROR: An unknown error occurred');
  }
  process.exit(1);
}

// Run the CLI
program.parse();
