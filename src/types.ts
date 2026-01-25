// LLDAP CLI Types

export interface Config {
  httpUrl: string;
  username: string;
  password?: string;
  token?: string;
  refreshToken?: string;
  configFile?: string;
  endpoints: {
    auth: string;
    graphql: string;
    logout: string;
    refresh: string;
  };
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

export interface User {
  id: string;
  creationDate: string;
  uuid: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface Group {
  id: number;
  creationDate: string;
  uuid: string;
  displayName: string;
}

export interface Attribute {
  name: string;
  value?: string[];
}

export interface SchemaAttribute {
  name: string;
  attributeType: AttributeType;
  isList: boolean;
  isVisible: boolean;
  isEditable: boolean;
}

export type AttributeType = 'STRING' | 'INTEGER' | 'DATE_TIME' | 'JPEG_PHOTO';

export type MutationType = 'set' | 'clear' | 'add' | 'del';

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export interface CreateUserInput {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface UpdateUserInput {
  id: string;
  insertAttributes?: {
    name: string;
    value: string | string[];
  };
  removeAttributes?: string;
}

export interface UpdateGroupInput {
  id: number;
  insertAttributes?: {
    name: string;
    value: string | string[];
  };
  removeAttributes?: string;
}
