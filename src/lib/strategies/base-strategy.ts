import { CaseConverter } from '@/lib/case-converter';
import type { CodeGenerationOptions, SwaggerApi, SwaggerApiRequest } from '@/types/swagger';

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

  protected convertSwaggerApiToApiEndpoint(swaggerApi: SwaggerApi): SwaggerApi {
    console.log('swaggerApi', swaggerApi);
    return {
      id: swaggerApi.id,
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
      response: swaggerApi.response,
      selected: swaggerApi.selected,
      request: swaggerApi.request,
    };
  }

  /**
   * Header (imports / init) for each strategy
   */
  protected abstract getHeader(): string;
  /**
   * Strategy-specific REST call implementation
   */
  public abstract generateImplementation(endpoint: SwaggerApi): string;

  /* PUBLIC – called by factory */
  generateCode(endpoints: SwaggerApi[], options?: Partial<CodeGenerationOptions>) {
    // 옵션 설정
    if (options) {
      this.setOptions(options);
    }

    const apiEndpoints = endpoints.map((api) => this.convertSwaggerApiToApiEndpoint(api));

    console.log('Code generation with options:', this.options);
    console.log('Converted endpoints:', apiEndpoints.length);

    const requestResponseInterfaces: string[] = [];
    const implementations: string[] = [];

    const definedInterfaces = new Set<string>();
    apiEndpoints.forEach((endpoint) => {
      const requestInterface = this.generateRequestInterface(endpoint);
      const responseInterface = this.generateResponseInterface(endpoint);
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
// - Or use a config object: config.apiBaseUrl

const API_BASE_URL = ''; // your api base url
`;
  }

  /* ===== Shared helpers ===== */

  public generateRequestInterface(endpoint: SwaggerApi) {
    const name = this.capitalize(
      this.generateFunctionName(endpoint.method, endpoint.path, endpoint.operationId),
    );
    const body = this.generateRequestInterfaceBody(endpoint);
    return `export interface ${name}Request {\n${body}\n}`;
  }

  /**
   * request.path / request.query / request.headers / request.body / request.formData 사용
   */
  public generateRequestInterfaceBody(endpoint: SwaggerApi) {
    const parts: string[] = [];
    const req: SwaggerApiRequest = endpoint.request || {};

    // Header parameters
    if (req.headers) {
      const hp = Object.entries(req.headers)
        .map(([rawName, schema]) => {
          const paramName = CaseConverter.convertCase(rawName, this.options.propertyNameCase);
          const type = this.generateTypeFromSchema(schema);
          return `    ${paramName}${''}: ${type};`;
        })
        .join('\n');
      parts.push(`  headers?: {\n${hp}\n  };`);
    } else {
      parts.push(`  headers?: Record<string, string>;`);
    }

    // Path parameters
    if (req.path) {
      for (const [rawName, schema] of Object.entries(req.path)) {
        const paramName = CaseConverter.convertCase(rawName, this.options.propertyNameCase);
        const type = this.generateTypeFromSchema(schema);
        parts.push(`  ${paramName}: ${type};`);
      }
    }

    // Query parameters
    if (req.query) {
      const qp = Object.entries(req.query)
        .map(([rawName, schema]) => {
          const paramName = CaseConverter.convertCase(rawName, this.options.propertyNameCase);
          const type = this.generateTypeFromSchema(schema);
          return `    ${paramName}${''}: ${type};`;
        })
        .join('\n');
      parts.push(`  query?: {\n${qp}\n  };`);
    }

    // Body parameter
    if (req.body) {
      const dtoName = this.extractDtoNameFromRef(req.body.$ref);
      if (dtoName) {
        parts.push(`  body: ${dtoName};`);
      } else {
        const inline = this.generateTypeFromSchema(req.body, 1);
        parts.push(`  body: ${inline};`);
      }
    }

    // FormData parameters
    if (req.formData) {
      const fm = Object.entries(req.formData)
        .map(([rawName, schema]) => {
          const paramName = CaseConverter.convertCase(rawName, this.options.propertyNameCase);
          const type = this.generateTypeFromSchema(schema);
          return `    ${paramName}${''}: ${type};`;
        })
        .join('\n');
      parts.push(`  formData?: {\n${fm}\n  };`);
    }

    return parts.join('\n');
  }

  public generateResponseInterface(endpoint: SwaggerApi) {
    const name = this.capitalize(
      this.generateFunctionName(endpoint.method, endpoint.path, endpoint.operationId),
    );
    const body = this.generateResponseInterfaceBody(endpoint);
    return `export interface ${name}Response {\n${body}\n}`;
  }

  public generateResponseInterfaceBody(endpoint: SwaggerApi): string {
    const parts: string[] = [];

    // 1) 성공 응답 (2xx) 찾기
    const successEntry = Object.entries(endpoint.response).find(([status]) =>
      status.startsWith('2'),
    );

    if (successEntry) {
      const [, resp] = successEntry as [string, any];
      // OpenAPI3 에서는 resp.response, Swagger2 에서는 resp.schema 에 담겨 있음
      const schema = resp.response ?? resp.schema;

      // 2) object 스키마면 flatten
      if (schema && (schema.type === 'object' || schema.properties)) {
        const props = schema.properties || {};
        const required = Array.isArray(schema.required) ? schema.required : [];
        const indent = '  ';

        for (const [rawName, propSchema] of Object.entries(props)) {
          const name = CaseConverter.convertCase(rawName, this.options.propertyNameCase);
          const tsType = this.generateTypeFromSchema(propSchema, 1);
          const optionalMark = required.includes(rawName) ? '' : '?';
          parts.push(`${indent}${name}${optionalMark}: ${tsType};`);
        }
      } else if (schema) {
        // 3) object 가 아니면 data: T 형태
        const typeStr = this.generateTypeFromSchema(schema, 2);
        parts.push(`  data: ${typeStr};`);
      } else {
        // 4) 스키마 자체가 없으면 void
        parts.push(`  data: void;`);
      }
    } else {
      // 5) 2xx 응답 자체가 없으면 void
      parts.push(`  data: void;`);
    }

    return parts.join('\n');
  }

  public generateFunctionName(method: string, path: string, operationId?: string) {
    if (operationId) {
      return CaseConverter.convertCase(operationId, this.options.functionNameCase);
    }
    const pathParts = path
      .split('/')
      .filter(Boolean)
      .map((p) => p.replace(/[{}]/g, ''));
    const words = [method.toLowerCase(), ...pathParts];
    const raw = words.join(' ');
    return CaseConverter.convertCase(raw, this.options.functionNameCase);
  }

  public capitalize(str: string) {
    return CaseConverter.convertCase(str, 'PascalCase');
  }

  protected indent(txt: string, spaces = 2) {
    const indentStr = ' '.repeat(spaces);
    return txt
      .split('\n')
      .map((line) => (line.trim() ? indentStr + line : line))
      .join('\n');
  }

  protected groupParameters(endpoint: SwaggerApi) {
    const pathParams = endpoint.parameters?.filter((p) => p.in === 'path') || [];
    const queryParams = endpoint.parameters?.filter((p) => p.in === 'query') || [];
    const headerParams = endpoint.parameters?.filter((p) => p.in === 'header') || [];
    const bodyParams = endpoint.parameters?.filter((p) => p.in === 'body') || [];
    const formData = endpoint.parameters?.filter((p) => p.in === 'formData') || [];
    return { pathParams, queryParams, headerParams, bodyParams, formData };
  }

  protected buildUrlWithPathParams(path: string, pathParams: any[]): string {
    let url = path;
    pathParams.forEach((param) => {
      const name = CaseConverter.convertCase(param.name, this.options.propertyNameCase);
      url = url.replace(`{${param.name}}`, `\${${name}}`);
    });
    return url;
  }

  private mapSwaggerTypeToTS(p: any): string {
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
          return p.enum.map((v: any) => `'${v}'`).join(' | ');
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
      return schema.$ref.split('/').pop() || 'any';
    }
    if (schema.type === 'array') {
      const itemType = this.generateTypeFromSchema(schema.items, indentLevel);
      return `${itemType}[]`;
    }
    if (schema.type === 'object' || schema.properties) {
      const props = schema.properties || {};
      const required = schema.required || [];
      const indent = '  '.repeat(indentLevel);
      const lines = Object.entries(props).map(([key, propSchema]) => {
        const propName = CaseConverter.convertCase(key, this.options.propertyNameCase);
        const propType = this.generateTypeFromSchema(propSchema, indentLevel + 1);
        const isReq = required.includes(key);
        return `${indent}  ${propName}${isReq ? '' : '?'}: ${propType};`;
      });
      return `{\n${lines.join('\n')}\n${indent}}`;
    }
    if (schema.enum) {
      return schema.enum.map((v: any) => `'${v}'`).join(' | ');
    }
    switch (schema.type) {
      case 'string':
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

  protected extractDtoNameFromRef(ref?: string): string | null {
    if (!ref) return null;
    const m = ref.match(/#\/definitions\/(.+)/);
    return m ? m[1] : null;
  }

  protected extractDtoNameFromResponse(response?: any): string | null {
    if (!response) return null;
    if (response.schema?.$ref) return this.extractDtoNameFromRef(response.schema.$ref);
    if (response.response?.$ref) return this.extractDtoNameFromRef(response.response.$ref);
    return null;
  }

  protected getResponseTypeName(endpoint: SwaggerApi): string {
    const success = Object.entries(endpoint.response).find(([s]) => s.startsWith('2'));
    if (success) {
      const [, resp] = success;
      const dto = this.extractDtoNameFromResponse(resp);
      if (dto) return dto;
    }
    return this.capitalize(
      this.generateFunctionName(endpoint.method, endpoint.path, endpoint.operationId),
    );
  }
}
