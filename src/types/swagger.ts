import { CaseType } from '@/lib/case-converter';

export interface SwaggerDocument {
  swagger?: string;
  openapi?: string;
  info: {
    title: string;
    description?: string;
    version: string;
  };
  paths: {
    [path: string]: {
      [method: string]: SwaggerOperation;
    };
  };
  components?: {
    schemas: {
      [key: string]: SwaggerSchema;
    };
  };
  // For Swagger 2.0
  definitions?: {
    [key: string]: SwaggerSchema;
  };
  tags?: Array<{
    name: string;
    description: string;
  }>;
}

export interface SwaggerOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: SwaggerParameter[];
  requestBody?: {
    required?: boolean;
    content: {
      [contentType: string]: {
        schema: SwaggerSchema;
      };
    };
  };
  responses: {
    [statusCode: string]: {
      description: string;
      schema?: SwaggerSchema;
      content?: {
        [contentType: string]: {
          schema: SwaggerSchema;
        };
      };
    };
  };
}

export interface SwaggerSchema {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  properties?: {
    [key: string]: SwaggerSchema;
  };
  items?: SwaggerSchema;
  required?: string[];
  enum?: any[];
  $ref?: string;
}

export interface SwaggerApi {
  id: string;
  path: string;
  method: string;
  summary: string;
  description?: string;
  operationId: string;
  tags: string[];
  parameters: SwaggerParameter[];
  request: SwaggerApiRequest;
  response: Record<string, SwaggerApiResponse>;
  requestBody?: any;
  selected?: boolean;
}

export interface SwaggerApiRequest {
  query?: Record<string, string>;
  path?: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
  formData?: Record<string, any>;
  cookies?: Record<string, any>;
}

export interface SwaggerApiResponse {
  description: string;
  schema?: SwaggerSchema;
  response: {
    type?: string;
    items: any;
    required?: string[];
    properties?: Record<string, any>;
  };
}

export interface SwaggerParameter {
  name: string;
  in: 'path' | 'query' | 'body' | 'formData' | 'header' | 'cookie';
  description?: string;
  required: boolean;
  type?: string;
  format?: string;
  schema?: any;
  items?: any;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

export interface SavedTemplate {
  id: string;
  name: string;
  template: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodeGenerationOptions {
  functionNameCase: CaseType;
  interfaceNameCase: CaseType;
  propertyNameCase: CaseType;
  includeComments: boolean;
  includeJSDoc: boolean;
  exportAsDefault: boolean;
}
