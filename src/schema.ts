import type { LldapClient } from './client';
import type { SchemaAttribute, AttributeType } from './types';

interface UserSchemaData {
  schema: {
    userSchema: {
      attributes: SchemaAttribute[];
      extraLdapObjectClasses: string[];
    };
  };
}

interface GroupSchemaData {
  schema: {
    groupSchema: {
      attributes: SchemaAttribute[];
      extraLdapObjectClasses: string[];
    };
  };
}

export class SchemaService {
  constructor(private client: LldapClient) {}

  // ============ User Attributes ============

  /**
   * Get user schema attributes
   */
  async getUserAttributes(): Promise<SchemaAttribute[]> {
    const query = '{schema{userSchema{attributes{name,attributeType,isList,isVisible,isEditable}}}}';
    const data = await this.client.query<UserSchemaData>(query);
    return data.schema.userSchema.attributes;
  }

  /**
   * Get user attribute type
   */
  async getUserAttributeType(name: string): Promise<AttributeType> {
    const attributes = await this.getUserAttributes();
    const attr = attributes.find((a) => a.name === name);
    if (!attr) {
      throw new Error(`Attribute ${name} is not part of user schema.`);
    }
    return attr.attributeType;
  }

  /**
   * Check if user attribute is a list
   */
  async isUserAttributeList(name: string): Promise<boolean> {
    const attributes = await this.getUserAttributes();
    const attr = attributes.find((a) => a.name === name);
    if (!attr) {
      throw new Error(`Attribute ${name} is not part of user schema.`);
    }
    return attr.isList;
  }

  /**
   * Add a user attribute to the schema
   */
  async addUserAttribute(
    name: string,
    type: AttributeType,
    options: { isList?: boolean; isVisible?: boolean; isEditable?: boolean } = {}
  ): Promise<void> {
    const query = `mutation addUserAttribute($name:String!,$type:AttributeType!,$isList:Boolean!,$isVisible:Boolean!,$isEditable:Boolean!){
      addUserAttribute(name:$name,attributeType:$type,isList:$isList,isVisible:$isVisible,isEditable:$isEditable){ok}
    }`;
    const variables = {
      name,
      type,
      isList: options.isList ?? false,
      isVisible: options.isVisible ?? false,
      isEditable: options.isEditable ?? false,
    };
    const data = await this.client.query<{ addUserAttribute: { ok: boolean } }>(query, variables);
    if (data.addUserAttribute.ok) {
      console.log(`Added in schema new user attribute: ${name}`);
    }
  }

  /**
   * Delete a user attribute from the schema
   */
  async deleteUserAttribute(name: string): Promise<void> {
    const query = 'mutation deleteUserAttribute($name:String!){deleteUserAttribute(name:$name){ok}}';
    const data = await this.client.query<{ deleteUserAttribute: { ok: boolean } }>(query, { name });
    if (data.deleteUserAttribute.ok) {
      console.log(`Deleted from schema user attribute: ${name}`);
    }
  }

  // ============ Group Attributes ============

  /**
   * Get group schema attributes
   */
  async getGroupAttributes(): Promise<SchemaAttribute[]> {
    const query = '{schema{groupSchema{attributes{name,attributeType,isList,isVisible,isEditable}}}}';
    const data = await this.client.query<GroupSchemaData>(query);
    return data.schema.groupSchema.attributes;
  }

  /**
   * Get group attribute type
   */
  async getGroupAttributeType(name: string): Promise<AttributeType> {
    const attributes = await this.getGroupAttributes();
    const attr = attributes.find((a) => a.name === name);
    if (!attr) {
      throw new Error(`Attribute ${name} is not part of group schema.`);
    }
    return attr.attributeType;
  }

  /**
   * Check if group attribute is a list
   */
  async isGroupAttributeList(name: string): Promise<boolean> {
    const attributes = await this.getGroupAttributes();
    const attr = attributes.find((a) => a.name === name);
    if (!attr) {
      throw new Error(`Attribute ${name} is not part of group schema.`);
    }
    return attr.isList;
  }

  /**
   * Add a group attribute to the schema
   */
  async addGroupAttribute(
    name: string,
    type: AttributeType,
    options: { isList?: boolean; isVisible?: boolean; isEditable?: boolean } = {}
  ): Promise<void> {
    const query = `mutation addGroupAttribute($name:String!,$type:AttributeType!,$isList:Boolean!,$isVisible:Boolean!,$isEditable:Boolean!){
      addGroupAttribute(name:$name,attributeType:$type,isList:$isList,isVisible:$isVisible,isEditable:$isEditable){ok}
    }`;
    const variables = {
      name,
      type,
      isList: options.isList ?? false,
      isVisible: options.isVisible ?? false,
      isEditable: options.isEditable ?? false,
    };
    const data = await this.client.query<{ addGroupAttribute: { ok: boolean } }>(query, variables);
    if (data.addGroupAttribute.ok) {
      console.log(`Added in schema new group attribute: ${name}`);
    }
  }

  /**
   * Delete a group attribute from the schema
   */
  async deleteGroupAttribute(name: string): Promise<void> {
    const query = 'mutation deleteGroupAttribute($name:String!){deleteGroupAttribute(name:$name){ok}}';
    const data = await this.client.query<{ deleteGroupAttribute: { ok: boolean } }>(query, { name });
    if (data.deleteGroupAttribute.ok) {
      console.log(`Deleted from schema group attribute: ${name}`);
    }
  }

  // ============ User Object Classes ============

  /**
   * List user object classes
   */
  async listUserObjectClasses(): Promise<string[]> {
    const query = '{schema{userSchema{extraLdapObjectClasses}}}';
    const data = await this.client.query<UserSchemaData>(query);
    return data.schema.userSchema.extraLdapObjectClasses;
  }

  /**
   * Add a user object class
   */
  async addUserObjectClass(name: string): Promise<void> {
    const query = 'mutation addUserObjectClass($name:String!){addUserObjectClass(name:$name){ok}}';
    const data = await this.client.query<{ addUserObjectClass: { ok: boolean } }>(query, { name });
    if (data.addUserObjectClass.ok) {
      console.log(`Defined in schema new LDAP extra user object class: ${name}`);
    }
  }

  /**
   * Delete a user object class
   */
  async deleteUserObjectClass(name: string): Promise<void> {
    const query = 'mutation deleteUserObjectClass($name:String!){deleteUserObjectClass(name:$name){ok}}';
    const data = await this.client.query<{ deleteUserObjectClass: { ok: boolean } }>(query, { name });
    if (data.deleteUserObjectClass.ok) {
      console.log(`Deleted from schema LDAP extra user object class: ${name}`);
    }
  }

  // ============ Group Object Classes ============

  /**
   * List group object classes
   */
  async listGroupObjectClasses(): Promise<string[]> {
    const query = '{schema{groupSchema{extraLdapObjectClasses}}}';
    const data = await this.client.query<GroupSchemaData>(query);
    return data.schema.groupSchema.extraLdapObjectClasses;
  }

  /**
   * Add a group object class
   */
  async addGroupObjectClass(name: string): Promise<void> {
    const query = 'mutation addGroupObjectClass($name:String!){addGroupObjectClass(name:$name){ok}}';
    const data = await this.client.query<{ addGroupObjectClass: { ok: boolean } }>(query, { name });
    if (data.addGroupObjectClass.ok) {
      console.log(`Defined in schema new LDAP extra group object class: ${name}`);
    }
  }

  /**
   * Delete a group object class
   */
  async deleteGroupObjectClass(name: string): Promise<void> {
    const query = 'mutation deleteGroupObjectClass($name:String!){deleteGroupObjectClass(name:$name){ok}}';
    const data = await this.client.query<{ deleteGroupObjectClass: { ok: boolean } }>(query, { name });
    if (data.deleteGroupObjectClass.ok) {
      console.log(`Deleted from schema LDAP extra group object class: ${name}`);
    }
  }
}
