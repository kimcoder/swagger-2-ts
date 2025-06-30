import { CaseConverter } from '@/lib/case-converter';
import type { ApiEndpoint, Parameter } from '@/types/api';
import type { CodeGenerationOptions, SwaggerApi } from '@/types/swagger';

export type StrategyType = 'fetch' | 'axios' | 'ky' | 'superagent';

/**
 * Abstract base – shared helpers live here.
 */
export abstract class BaseCodeGenerationStrategy {
  abstract readonly type: StrategyType;

  // 코드 생성 옵션
  protected options: CodeGenerationOptions = {
    functionNameCase: 'camelCase',
    interfaceNameCase: 'PascalCase',
    propertyNameCase: 'camelCase',
    includeComments: true,
    includeJSDoc: true,
    exportAsDefault: false,
  };

  /**
   * 코드 생성 옵션 설정
   */
  setOptions(options: Partial<CodeGenerationOptions>) {
    this.options = { ...this.options, ...options };
  }

  /**
   * SwaggerApi를 ApiEndpoint로 변환
   */
  protected convertSwaggerApiToApiEndpoint(swaggerApi: SwaggerApi): ApiEndpoint {
    return {
      path: swaggerApi.path,
      method: swaggerApi.method,
      summary: swaggerApi.summary,
      description: swaggerApi.description,
      operationId: swaggerApi.operationId,
      tags: swaggerApi.tags,
      parameters: swaggerApi.parameters.map((param) => ({
        name: CaseConverter.convertCase(param.name, this.options.propertyNameCase),
        in: param.in,
        description: param.description,
        required: param.required,
        type: param.type,
        format: param.format,
        schema: param.schema,
        items: param.items,
        enum: param.enum,
        minimum: param.minimum,
        maximum: param.maximum,
      })),
      responses: swaggerApi.responses,
      selected: swaggerApi.selected,
    };
  }

  /**
   * Header (imports / init) for each strategy
   */
  protected abstract getHeader(): string;
  /**
   * Strategy-specific REST call implementation
   */
  public abstract generateImplementation(endpoint: ApiEndpoint): string;

  /* PUBLIC – called by factory */
  generateCode(endpoints: SwaggerApi[], options?: Partial<CodeGenerationOptions>) {
    // 옵션 설정
    if (options) {
      this.setOptions(options);
    }

    // SwaggerApi를 ApiEndpoint로 변환
    const apiEndpoints = endpoints.map((api) => this.convertSwaggerApiToApiEndpoint(api));

    console.log('Code generation with options:', this.options);
    console.log('Converted endpoints:', apiEndpoints.length);

    const dataModels = new Set<string>(); // 순수 데이터 모델 추적
    const dataModelInterfaces: string[] = [];
    const requestResponseInterfaces: string[] = [];
    const implementations: string[] = [];
    const requiredModels = new Set<string>(); // 요청에서 사용되는 모델 추적

    // 0단계: 기본 데이터 모델을 항상 먼저 생성
    const basicModels = ['User', 'Pet', 'Order', 'Category', 'Tag'];
    basicModels.forEach((modelName) => {
      const modelInterface = this.generateBasicModel(modelName);
      if (modelInterface) {
        dataModelInterfaces.push(modelInterface);
        dataModels.add(modelName);
      } else {
        // 스웨거 문서에서 가져올 수 없는 경우 기본 모델 생성
        const fallbackModel = this.generateFallbackModel(modelName);
        if (fallbackModel) {
          dataModelInterfaces.push(fallbackModel);
          dataModels.add(modelName);
        }
      }
    });

    // 1단계: 요청에서 사용되는 모델 감지
    apiEndpoints.forEach((endpoint) => {
      const requestInterface = this.generateRequestInterface(endpoint);

      // body: User, body: Pet 등에서 모델 이름 추출
      const bodyModelMatch = requestInterface.match(/body: (User|Pet|Order|Category|Tag)/);
      if (bodyModelMatch) {
        requiredModels.add(bodyModelMatch[1]);
      }
    });

    // 2단계: 순수 데이터 모델 먼저 생성 (이미 생성된 모델은 건너뛰기)
    apiEndpoints.forEach((endpoint) => {
      const responseInterface = this.generateResponseInterface(endpoint);

      // 순수 데이터 모델인지 확인 (User, Pet, Order 등)
      const dataModelMatch = responseInterface.match(
        /export interface (User|Pet|Order|Category|Tag) \{/,
      );
      if (dataModelMatch) {
        const modelName = dataModelMatch[1];
        if (!dataModels.has(modelName)) {
          dataModelInterfaces.push(responseInterface);
          dataModels.add(modelName);
        }
      }
    });

    // 3단계: 요청/응답 인터페이스 생성
    const definedInterfaces = new Set<string>();
    apiEndpoints.forEach((endpoint) => {
      const requestInterface = this.generateRequestInterface(endpoint);
      const responseInterface = this.generateResponseInterface(endpoint);

      // 순수 데이터 모델이 아닌 경우만 요청/응답 인터페이스 생성
      const isDataModel = requestInterface.match(
        /export interface (User|Pet|Order|Category|Tag) \{/,
      );
      if (!isDataModel) {
        const requestName = requestInterface.match(/export interface (\w+)/)?.[1];
        const responseName = responseInterface.match(/export interface (\w+)/)?.[1];

        if (requestName && !definedInterfaces.has(requestName)) {
          requestResponseInterfaces.push(requestInterface);
          definedInterfaces.add(requestName);
        }

        if (responseName && !definedInterfaces.has(responseName)) {
          requestResponseInterfaces.push(responseInterface);
          definedInterfaces.add(responseName);
        }
      }
    });

    // 4단계: 함수 구현 생성
    apiEndpoints.forEach((endpoint) => {
      const implementation = this.generateImplementation(endpoint);
      implementations.push(implementation);
    });

    return (
      this.getHeader() +
      '\n\n' +
      this.generateConfigSection() +
      '\n\n' +
      dataModelInterfaces.join('\n\n') +
      '\n\n' +
      requestResponseInterfaces.join('\n\n') +
      '\n\n' +
      implementations.join('\n\n')
    );
  }

  protected generateConfigSection(): string {
    return `// API Configuration
// You can customize this based on your environment:
// - For Next.js: process.env.NEXT_PUBLIC_API_BASE_URL
// - For Vite: import.meta.env.VITE_API_BASE_URL  
// - For Create React App: process.env.REACT_APP_API_BASE_URL
// - For Node.js: process.env.API_BASE_URL
// - Or use a config object: config.apiBaseUrl
const API_BASE_URL = (() => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NEXT_PUBLIC_API_BASE_URL || 
           process.env.REACT_APP_API_BASE_URL || 
           process.env.VITE_API_BASE_URL || 
           process.env.API_BASE_URL || '';
  }
  if (typeof window !== 'undefined' && (window as any).API_BASE_URL) {
    return (window as any).API_BASE_URL;
  }
  // @ts-ignore - for Vite
  if (typeof import !== 'undefined' && (import as any).meta?.env?.VITE_API_BASE_URL) {
    return (import as any).meta.env.VITE_API_BASE_URL;
  }
  return '';
})();
`;
  }

  /* ===== Shared helpers ===== */

  public generateRequestInterface(endpoint: ApiEndpoint) {
    const name = this.capitalize(
      this.generateFunctionName(endpoint.method, endpoint.path, endpoint.operationId),
    );
    const body = this.generateRequestInterfaceBody(endpoint);
    return `export interface ${name}Request {\n${body}\n}`;
  }

  public generateRequestInterfaceBody(endpoint: ApiEndpoint) {
    const parts: string[] = [];

    // Path parameters
    const pathParams = endpoint.parameters?.filter((p) => p.in === 'path') || [];
    if (pathParams.length > 0) {
      pathParams.forEach((param) => {
        const type = this.mapSwaggerTypeToTS(param);
        const paramName = CaseConverter.convertCase(param.name, this.options.propertyNameCase);
        parts.push(`  ${paramName}: ${type};`);
      });
    }

    // Query parameters
    const queryParams = endpoint.parameters?.filter((p) => p.in === 'query') || [];
    if (queryParams.length > 0) {
      const queryProps = queryParams
        .map((param) => {
          const type = this.mapSwaggerTypeToTS(param);
          const paramName = CaseConverter.convertCase(param.name, this.options.propertyNameCase);
          return `    ${paramName}${param.required ? '' : '?'}: ${type};`;
        })
        .join('\n');
      parts.push(`  query?: {\n${queryProps}\n  };`);
    }

    // Header parameters
    const headerParams = endpoint.parameters?.filter((p) => p.in === 'header') || [];
    if (headerParams.length > 0) {
      const headerProps = headerParams
        .map((param) => {
          const type = this.mapSwaggerTypeToTS(param);
          const paramName = CaseConverter.convertCase(param.name, this.options.propertyNameCase);
          return `    ${paramName}${param.required ? '' : '?'}: ${type};`;
        })
        .join('\n');
      parts.push(`  headers?: {\n${headerProps}\n  };`);
    }

    // Body parameter
    const bodyParam = endpoint.parameters?.find((p) => p.in === 'body');
    if (bodyParam?.schema) {
      // Try to extract DTO name from body schema
      let dtoName = this.extractDtoNameFromRef(bodyParam.schema.$ref);

      // If no $ref, try to match with known DTOs by schema structure
      if (!dtoName) {
        console.log(
          `[DEBUG] Trying to match schema for ${endpoint.operationId}:`,
          bodyParam.schema,
        );
        dtoName = this.matchSchemaToDto(bodyParam.schema);
        console.log(`[DEBUG] Matched DTO: ${dtoName}`);
      }

      if (dtoName) {
        parts.push(`  body: ${dtoName};`);
      } else {
        // Generate inline type from schema
        const bodyType = this.generateTypeFromSchema(bodyParam.schema);
        parts.push(`  body: ${bodyType};`);
      }
    }

    // FormData parameters
    const formDataParams = endpoint.parameters?.filter((p) => p.in === 'formData') || [];
    if (formDataParams.length > 0) {
      const formDataProps = formDataParams
        .map((param) => {
          const type = this.mapSwaggerTypeToTS(param);
          const paramName = CaseConverter.convertCase(param.name, this.options.propertyNameCase);
          return `    ${paramName}${param.required ? '' : '?'}: ${type};`;
        })
        .join('\n');
      parts.push(`  formData?: {\n${formDataProps}\n  };`);
    }

    // Add headers and formData as optional properties for all requests
    if (headerParams.length === 0) {
      parts.push(`  headers?: Record<string, string>;`);
    }
    if (formDataParams.length === 0 && bodyParam?.schema) {
      parts.push(`  formData?: Record<string, any>;`);
    }

    return parts.join('\n');
  }

  public generateResponseInterface(endpoint: ApiEndpoint) {
    const name = this.capitalize(
      this.generateFunctionName(endpoint.method, endpoint.path, endpoint.operationId),
    );
    const body = this.generateResponseInterfaceBody(endpoint);
    return `export interface ${name}Response {\n${body}\n}`;
  }

  public generateResponseInterfaceBody(endpoint: ApiEndpoint) {
    const parts: string[] = [];

    // Find successful response (200, 201, etc.)
    const successResponse = Object.entries(endpoint.responses).find(([status]) =>
      status.startsWith('2'),
    );

    if (successResponse) {
      const [, response] = successResponse;
      if (response.response) {
        // Use resolved response schema
        const responseType = this.generateTypeFromSchema(response.response, 2);
        parts.push(`  data: ${responseType};`);
      } else if (response.schema) {
        // Use original schema
        const responseType = this.generateTypeFromSchema(response.schema, 2);
        parts.push(`  data: ${responseType};`);
      } else {
        // No schema, use void
        parts.push(`  data: void;`);
      }
    } else {
      // No successful response found
      parts.push(`  data: void;`);
    }

    // Add common response fields
    parts.push(`  status: number;`);
    parts.push(`  statusText: string;`);
    parts.push(`  headers: Record<string, string>;`);

    return parts.join('\n');
  }

  public generateFunctionName(method: string, path: string, operationId?: string) {
    if (operationId) {
      const result = CaseConverter.convertCase(operationId, this.options.functionNameCase);
      return result;
    }

    // Generate from method + path
    const pathParts = path
      .split('/')
      .filter(Boolean)
      .map((part) => part.replace(/[{}]/g, ''));

    // Create a descriptive function name from method and path
    const words = [method.toLowerCase(), ...pathParts];
    const functionName = words.join(' ');
    const result = CaseConverter.convertCase(functionName, this.options.functionNameCase);

    return result;
  }

  public capitalize(str: string) {
    // 인터페이스명은 항상 파스칼 케이스로 생성
    return CaseConverter.convertCase(str, 'PascalCase');
  }

  protected indent(txt: string, spaces = 2) {
    const indentStr = ' '.repeat(spaces);
    return txt
      .split('\n')
      .map((line) => (line.trim() ? indentStr + line : line))
      .join('\n');
  }

  protected groupParameters(endpoint: ApiEndpoint) {
    const pathParams = endpoint.parameters?.filter((p) => p.in === 'path') || [];
    const queryParams = endpoint.parameters?.filter((p) => p.in === 'query') || [];
    const headerParams = endpoint.parameters?.filter((p) => p.in === 'header') || [];
    const bodyParams = endpoint.parameters?.filter((p) => p.in === 'body') || [];
    const formDataParams = endpoint.parameters?.filter((p) => p.in === 'formData') || [];

    return { pathParams, queryParams, headerParams, bodyParams, formData: formDataParams };
  }

  protected buildUrlWithPathParams(path: string, pathParams: any[]): string {
    let url = path;
    pathParams.forEach((param) => {
      const paramName = CaseConverter.convertCase(param.name, this.options.propertyNameCase);
      url = url.replace(`{${param.name}}`, `\${${paramName}}`);
    });
    return url;
  }

  private mapSwaggerTypeToTS(p: Parameter): string {
    if (p.schema) {
      return this.generateTypeFromSchema(p.schema);
    }

    if (p.type === 'array' && p.items) {
      const itemType = this.mapSwaggerTypeToTS(p.items);
      return `${itemType}[]`;
    }

    switch (p.type) {
      case 'string':
        if (p.enum) {
          return p.enum.map((v) => `'${v}'`).join(' | ');
        }
        if (p.format === 'date-time') {
          return 'string'; // or 'Date' if you prefer
        }
        return 'string';
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'file':
        return 'File';
      default:
        return 'any';
    }
  }

  protected generateTypeFromSchema(schema: any, indentLevel: number = 0): string {
    if (!schema) return 'any';

    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      return refName || 'any';
    }

    if (schema.type === 'array') {
      const itemType = this.generateTypeFromSchema(schema.items, indentLevel);
      return `${itemType}[]`;
    }

    if (schema.type === 'object' || schema.properties) {
      const properties = schema.properties || {};
      const required = schema.required || [];
      const indent = '  '.repeat(indentLevel);

      const propStrings = Object.entries(properties).map(([key, propSchema]) => {
        const propName = CaseConverter.convertCase(key, this.options.propertyNameCase);
        const propType = this.generateTypeFromSchema(propSchema, indentLevel + 1);
        const isRequired = required.includes(key);

        return `${indent}  ${propName}${isRequired ? '' : '?'}: ${propType};`;
      });

      return `{\n${propStrings.join('\n')}\n${indent}}`;
    }

    if (schema.enum) {
      return schema.enum.map((v: any) => `'${v}'`).join(' | ');
    }

    switch (schema.type) {
      case 'string':
        if (schema.format === 'date-time') {
          return 'string'; // or 'Date'
        }
        return 'string';
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      default:
        return 'any';
    }
  }

  protected extractDtoNameFromResponse(response?: any): string | null {
    if (!response) return null;

    if (response.schema?.$ref) {
      return this.extractDtoNameFromRef(response.schema.$ref);
    }

    if (response.response?.$ref) {
      return this.extractDtoNameFromRef(response.response.$ref);
    }

    return null;
  }

  protected extractDtoNameFromRef(ref: string): string | null {
    if (!ref) return null;
    const match = ref.match(/#\/definitions\/(.+)/);
    return match ? match[1] : null;
  }

  protected getResponseTypeName(endpoint: ApiEndpoint): string {
    const successResponse = Object.entries(endpoint.responses).find(([status]) =>
      status.startsWith('2'),
    );

    if (successResponse) {
      const [, response] = successResponse;
      const dtoName = this.extractDtoNameFromResponse(response);
      if (dtoName) {
        return dtoName;
      }
    }

    // Fallback: generate from operation
    return this.capitalize(
      this.generateFunctionName(endpoint.method, endpoint.path, endpoint.operationId),
    );
  }

  protected matchSchemaToDto(schema: any): string | null {
    // This is a simplified matching logic
    // In a real implementation, you might want to compare schema structures
    const swaggerDoc = this.getSwaggerDocument();
    if (!swaggerDoc?.definitions) return null;

    for (const [dtoName, dtoSchema] of Object.entries(swaggerDoc.definitions)) {
      if (this.isSchemaMatch(schema, dtoSchema)) {
        return dtoName;
      }
    }

    return null;
  }

  protected getSwaggerDocument(): any {
    // This would need to be implemented based on how you access the swagger document
    // For now, return null
    return null;
  }

  private isSchemaMatch(schema1: any, schema2: any): boolean {
    // Simplified schema matching
    if (schema1.type !== schema2.type) return false;
    if (schema1.type === 'object') {
      const props1 = Object.keys(schema1.properties || {});
      const props2 = Object.keys(schema2.properties || {});
      return props1.length === props2.length && props1.every((p) => props2.includes(p));
    }
    return true;
  }

  protected generateBasicModel(modelName: string): string | null {
    const swaggerDoc = this.getSwaggerDocument();
    if (!swaggerDoc?.definitions?.[modelName]) return null;

    const schema = swaggerDoc.definitions[modelName];
    return this.generateInterfaceFromSchema(modelName, schema);
  }

  private generateInterfaceFromSchema(modelName: string, schema: any): string {
    const properties = schema.properties || {};
    const required = schema.required || [];
    const indent = '  ';

    const propStrings = Object.entries(properties).map(([key, propSchema]) => {
      const propName = CaseConverter.convertCase(key, this.options.propertyNameCase);
      const propType = this.generateTypeFromSchema(propSchema, 1);
      const isRequired = required.includes(key);
      return `${indent}${propName}${isRequired ? '' : '?'}: ${propType};`;
    });

    return `export interface ${modelName} {\n${propStrings.join('\n')}\n}`;
  }

  private generateFallbackModel(modelName: string): string | null {
    // Generate basic fallback models
    const fallbackModels: Record<string, string> = {
      User: `export interface User {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  userStatus?: number;
}`,
      Pet: `export interface Pet {
  id?: number;
  category?: Category;
  name: string;
  photoUrls: string[];
  tags?: Tag[];
  status?: 'available' | 'pending' | 'sold';
}`,
      Order: `export interface Order {
  id?: number;
  petId: number;
  quantity: number;
  shipDate?: string;
  status?: 'placed' | 'approved' | 'delivered';
  complete?: boolean;
}`,
      Category: `export interface Category {
  id?: number;
  name: string;
}`,
      Tag: `export interface Tag {
  id?: number;
  name: string;
}`,
    };

    return fallbackModels[modelName] || null;
  }
}
