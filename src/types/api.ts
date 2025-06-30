export interface Parameter {
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

export interface Response {
  description: string;
  schema?: any;
  response?: any;
  headers?: any;
}

export interface ApiEndpoint {
  path: string;
  method: string;
  summary: string;
  description?: string;
  operationId: string;
  tags: string[];
  parameters: Parameter[];
  responses: Record<string, Response>;
  selected?: boolean;
}

export interface SavedTemplate {
  id: string;
  name: string;
  template: string;
  createdAt: string;
  updatedAt: string;
}
