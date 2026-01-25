import type { LldapClient } from './client';
import type { Group, MutationType, SchemaAttribute } from './types';

interface GroupsData {
  groups: Group[];
}

interface GroupData {
  group: {
    users: Array<{ id: string; email: string }>;
    attributes: Array<{ name: string; value: string[] }>;
  };
}

interface SchemaData {
  schema: {
    groupSchema: {
      attributes: SchemaAttribute[];
    };
  };
}

export class GroupService {
  constructor(private client: LldapClient) {}

  /**
   * Get all groups
   */
  async getGroups(): Promise<Group[]> {
    const query = '{groups{id creationDate uuid displayName}}';
    const data = await this.client.query<GroupsData>(query);
    return data.groups;
  }

  /**
   * Get group ID by name
   */
  async getGroupId(name: string): Promise<number> {
    const groups = await this.getGroups();
    const group = groups.find((g) => g.displayName === name);
    if (!group) {
      throw new Error(`Failed to retrieve group ID for group: ${name}`);
    }
    return group.id;
  }

  /**
   * List user IDs in a group
   */
  async listUserIdsByGroupName(groupName: string): Promise<string[]> {
    const groupId = await this.getGroupId(groupName);
    const query = 'query listUsersByGroupName($id:Int!){group:group(groupId:$id){users{id}}}';
    const data = await this.client.query<GroupData>(query, { id: groupId });
    return data.group.users.map((u) => u.id);
  }

  /**
   * List user emails in a group
   */
  async listUserEmailsByGroupName(groupName: string): Promise<string[]> {
    const groupId = await this.getGroupId(groupName);
    const query = 'query listUsersByGroupName($id:Int!){group:group(groupId:$id){users{email}}}';
    const data = await this.client.query<GroupData>(query, { id: groupId });
    return data.group.users.map((u) => u.email);
  }

  /**
   * List group attributes
   */
  async listGroupAttributes(groupId: number): Promise<string[]> {
    const query = 'query getGroupInfo($id:Int!){group(groupId:$id){attributes{name}}}';
    const data = await this.client.query<GroupData>(query, { id: groupId });
    return data.group.attributes.map((a) => a.name).sort();
  }

  /**
   * Get group attribute values
   */
  async getGroupAttributeValues(groupId: number, attribute: string): Promise<string[]> {
    const query = 'query getGroupInfo($id:Int!){group(groupId:$id){attributes{name,value}}}';
    const data = await this.client.query<GroupData>(query, { id: groupId });
    const attr = data.group.attributes.find((a) => a.name === attribute);
    return attr?.value || [];
  }

  /**
   * Create a new group
   */
  async createGroup(name: string): Promise<void> {
    const query = 'mutation createGroup($group:String!){createGroup(name:$group){id}}';
    await this.client.query(query, { group: name });
    console.log(`Created group: ${name}`);
  }

  /**
   * Delete a group
   */
  async deleteGroup(name: string): Promise<void> {
    const groupId = await this.getGroupId(name);
    const query = 'mutation deleteGroup($id:Int!){deleteGroup(groupId:$id){ok}}';
    const data = await this.client.query<{ deleteGroup: { ok: boolean } }>(query, { id: groupId });
    if (data.deleteGroup.ok) {
      console.log(`Deleted group: ${name}`);
    } else {
      throw new Error(`Failed to delete group: ${name}`);
    }
  }

  /**
   * Get schema info for a group attribute
   */
  private async getSchemaAttribute(attribute: string): Promise<SchemaAttribute | null> {
    const query = '{schema{groupSchema{attributes{name,attributeType,isList,isVisible,isEditable}}}}';
    const data = await this.client.query<SchemaData>(query);
    return data.schema.groupSchema.attributes.find((a) => a.name === attribute) || null;
  }

  /**
   * Update a group attribute
   */
  async updateGroupAttribute(
    mutation: MutationType,
    groupName: string,
    attribute: string,
    value?: string
  ): Promise<void> {
    const groupId = await this.getGroupId(groupName);
    const schemaAttr = await this.getSchemaAttribute(attribute);
    if (!schemaAttr) {
      throw new Error(`Attribute ${attribute} is not part of group schema.`);
    }

    const isList = schemaAttr.isList;

    // Validate mutation type vs attribute type
    if (mutation === 'set' && isList) {
      throw new Error(`Attribute ${attribute} is a list and cannot be modified using the ${mutation} mutation.`);
    }
    if ((mutation === 'add' || mutation === 'del') && !isList) {
      throw new Error(`Attribute ${attribute} is not a list and cannot be modified using the ${mutation} mutation.`);
    }

    const query = 'mutation updateGroup($group:UpdateGroupInput!){updateGroup(group:$group){ok}}';
    let variables: Record<string, unknown>;
    let resultLine: string;

    switch (mutation) {
      case 'set':
        variables = {
          group: {
            id: groupId,
            insertAttributes: { name: attribute, value: value || '' },
          },
        };
        resultLine = `Attribute set for group: ${groupName}, attribute: ${attribute}`;
        if (value && schemaAttr.attributeType !== 'JPEG_PHOTO') {
          resultLine += `, value: ${value}`;
        }
        break;

      case 'clear': {
        const currentValues = await this.getGroupAttributeValues(groupId, attribute);
        if (currentValues.length === 0) {
          throw new Error(`Attribute ${attribute} has no value set for group ${groupName}, so nothing to clear.`);
        }
        variables = {
          group: {
            id: groupId,
            removeAttributes: attribute,
          },
        };
        resultLine = `Attribute cleared for group: ${groupName}, attribute: ${attribute}`;
        break;
      }

      case 'add': {
        if (!value) {
          throw new Error('Value is required for add mutation');
        }
        const currentValues = await this.getGroupAttributeValues(groupId, attribute);
        const newValues = [...currentValues, value];
        variables = {
          group: {
            id: groupId,
            insertAttributes: { name: attribute, value: newValues },
          },
        };
        resultLine = `Attribute list value added for group: ${groupName}, attribute: ${attribute}, value: ${value}`;
        break;
      }

      case 'del': {
        if (!value) {
          throw new Error('Value is required for del mutation');
        }
        const currentValues = await this.getGroupAttributeValues(groupId, attribute);
        if (!currentValues.includes(value)) {
          throw new Error(`Attribute ${attribute} has no listed value ${value} for group ${groupName}, so no value to delete.`);
        }
        const newValues = currentValues.filter((v) => v !== value);
        if (newValues.length === 0) {
          // Clear the entire attribute
          return this.updateGroupAttribute('clear', groupName, attribute);
        }
        variables = {
          group: {
            id: groupId,
            insertAttributes: { name: attribute, value: newValues },
          },
        };
        resultLine = `Attribute list value deleted for group: ${groupName}, attribute: ${attribute}, value: ${value}`;
        break;
      }

      default:
        throw new Error(`Unknown mutation type: ${mutation}`);
    }

    await this.client.query(query, variables);
    console.log(resultLine);
  }
}
