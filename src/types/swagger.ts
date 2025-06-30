import { CaseType } from '@/lib/case-converter';

export interface SwaggerPath {
  [path: string]: {
    [method: string]: SwaggerOperation;
  };
}

export interface SwaggerOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: SwaggerParameter[];
  requestBody?: SwaggerRequestBody;
  responses: {
    [statusCode: string]: SwaggerResponse;
  };
}

export interface SwaggerRequestBody {
  required?: boolean;
  content: {
    [contentType: string]: {
      schema: SwaggerSchema;
    };
  };
}

export interface SwaggerResponse {
  description: string;
  schema?: SwaggerSchema;
  content?: {
    [contentType: string]: {
      schema: SwaggerSchema;
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

export interface SwaggerDocument {
  swagger?: string;
  openapi?: string;
  info: {
    title: string;
    description?: string;
    version: string;
  };
  paths: SwaggerPath;
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

// ApiEndpoint와 호환되는 SwaggerApi 타입
export interface SwaggerApi {
  id: string;
  path: string;
  method: string;
  summary: string;
  description?: string;
  operationId: string;
  tags: string[];
  parameters: SwaggerParameter[];
  responses: Record<string, SwaggerResponse>;
  requestBody?: any;
  selected?: boolean;
}

export interface SwaggerParameter {
  name: string;
  in: 'path' | 'query' | 'body' | 'formData' | 'header';
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
