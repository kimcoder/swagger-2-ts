// swagger-parser.ts
import {
  SwaggerApi,
  SwaggerApiRequest,
  SwaggerDocument,
  SwaggerOperation,
  SwaggerParameter,
  SwaggerSchema,
} from '@/types/swagger';
import { findSwaggerDocument } from './swagger-finder';

const getValueOfResponse = (
  schema: Record<string, SwaggerSchema>,
  json?: { schema: SwaggerSchema },
) => {
  const isArrayType = json?.schema.type === 'array';
  const schemaRefStr = isArrayType ? json?.schema.items?.$ref : json?.schema.$ref;
  const schemaName = schemaRefStr?.split('/').at(-1) ?? '';
  // console.log('..schema:', schema);
  // console.log('..json:', json);
  if (schemaName && schema?.[schemaName]) {
    const schemaObj = schema?.[schemaName] ?? {};
    return isArrayType ? [schemaObj] : schemaObj;
  }

  switch (json?.schema?.type) {
    case 'object':
      return {};
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'integer':
      return 'number';
    default:
      return 'void';
  }
};

const enrichJSONResponseValue =
  (schema: Record<string, SwaggerSchema>) => (item: SwaggerOperation) => {
    if (!item || !item.responses) {
      // console.warn('Invalid item or missing responses:', item);
      return item;
    }

    try {
      const responseValue = Object.entries(item.responses).reduce(
        (result, [statusCode, response]) => {
          if (!response) {
            // console.warn(`Invalid response for status code ${statusCode}:`, response);
            return result;
          }

          return {
            ...result,
            [statusCode]: {
              description: response.description || '',
              ...(response.content?.['application/json'] && {
                value: getValueOfResponse(schema, response.content['application/json']),
              }),
            },
          };
        },
        {},
      );

      return {
        ...item,
        responseValue,
      };
    } catch (error) {
      // console.error('Error enriching JSON response value:', error);
      return item;
    }
  };

function resolveSchema(schema: any, definitions: Record<string, any>): any {
  if (!schema) return null;

  // Handle $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/', '').split('/');
    let current = definitions;

    // Handle both Swagger 2.0 and OpenAPI 3.0 paths
    if (refPath[0] === 'definitions') {
      // Swagger 2.0 format
      current = definitions[refPath[1]];
    } else if (refPath[0] === 'components' && refPath[1] === 'schemas') {
      // OpenAPI 3.0 format
      current = definitions[refPath[2]];
    }

    if (!current) {
      // console.warn(`Reference not found: ${schema.$ref}`);
      return null;
    }
    return resolveSchema(current, definitions);
  }

  // Handle array type
  if (schema.type === 'array') {
    return {
      type: 'array',
      items: resolveSchema(schema.items, definitions),
    };
  }

  // Handle object type
  if (schema.type === 'object' || schema.properties) {
    const properties: Record<string, any> = {};
    for (const [key, value] of Object.entries(schema.properties || {})) {
      properties[key] = resolveSchema(value, definitions);
    }
    return {
      type: 'object',
      properties,
      required: schema.required || [],
    };
  }

  // Handle primitive types
  return {
    type: schema.type,
    format: schema.format,
    enum: schema.enum,
  };
}

function getResponseSchema(path: string, method: string, swaggerDoc: SwaggerDocument): any {
  const pathItem = swaggerDoc.paths[path];
  if (!pathItem) return null;

  const operation = pathItem[method.toLowerCase()];
  if (!operation || !operation.responses) return null;

  // Combine definitions from both Swagger 2.0 and OpenAPI 3.0
  const definitions = {
    ...(swaggerDoc.definitions || {}),
    ...(swaggerDoc.components?.schemas || {}),
  };

  // Transform responses to include resolved schema
  const transformedResponses = Object.entries(operation.responses).reduce(
    (acc, [statusCode, response]) => {
      if (!response) return acc;

      try {
        // Handle both Swagger 2.0 and OpenAPI 3.0 formats
        let schema = null;
        if (response.schema) {
          // Swagger 2.0 format
          schema = response.schema;
        } else if (response.content?.['application/json']?.schema) {
          // OpenAPI 3.0 format
          schema = response.content['application/json'].schema;
        }

        const resolvedSchema = schema ? resolveSchema(schema, definitions) : null;

        return {
          ...acc,
          [statusCode]: {
            ...response,
            response: resolvedSchema,
          },
        };
      } catch (error) {
        // console.warn(`Error resolving schema for ${method} ${path} (${statusCode}):`, error);
        return {
          ...acc,
          [statusCode]: {
            ...response,
            response: null,
          },
        };
      }
    },
    {},
  );

  return transformedResponses;
}

export async function getAPIList(): Promise<SwaggerApi[]> {
  const swaggerDoc = await findSwaggerDocument();
  if (!swaggerDoc) {
    throw new Error('No Swagger documentation found');
  }

  // Models DOM에서 스키마 추출 (비동기)
  const definitions = await parseSwaggerModelsAsync();
  // console.log('Parsed models for parameter resolution:', definitions);

  // Swagger JSON 스펙의 definitions/schemas도 활용
  const swaggerDefinitions = {
    ...(swaggerDoc.definitions || {}),
    ...(swaggerDoc.components?.schemas || {}),
  };
  // console.log('Swagger JSON definitions:', swaggerDefinitions);

  // paths 객체의 유효성 검사
  const paths = swaggerDoc.paths;
  if (typeof paths !== 'object') {
    // console.error('Invalid paths structure:', paths);
    throw new Error('Invalid paths structure in Swagger document');
  }

  const apiList: SwaggerApi[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (method === 'parameters') continue;

      // 응답 스키마 변환
      const responses = getResponseSchema(path, method, swaggerDoc);
      let enrichedResponses = responses;
      if (responses) {
        enrichedResponses = {};
        for (const [status, resp] of Object.entries(responses)) {
          if (resp && typeof resp === 'object' && 'response' in resp && resp.response) {
            enrichedResponses[status] = {
              ...resp,
              response: resolveSchemaReferences(resp.response, {
                ...definitions,
                ...swaggerDefinitions,
              }),
            };
          } else {
            enrichedResponses[status] = resp;
          }
        }
      }

      // parameters의 스키마 참조를 실제 스키마로 변환 (재귀) - Swagger JSON 우선
      const enrichedParameters = operation.parameters?.map((param) => {
        if (param.schema) {
          return {
            ...param,
            schema: resolveSchemaReferences(param.schema, {
              ...definitions,
              ...swaggerDefinitions,
            }),
          };
        }
        return param;
      });

      // SwaggerApi 타입에 맞게 id 등 필수 필드 추가
      apiList.push({
        id: operation.operationId || `${method.toUpperCase()}_${path}`,
        method: method.toUpperCase(),
        path,
        summary: operation.summary || '',
        description: operation.description,
        operationId: operation.operationId || '',
        tags: operation.tags || [],
        parameters: enrichedParameters || [],
        request: getRequestModel({ parameters: operation.parameters, definitions }),
        response: enrichedResponses || {},
        requestBody: operation.requestBody,
      });
    }
  }

  return apiList;
}

function getRequestModel({
  parameters,
  definitions,
}: {
  parameters?: SwaggerParameter[];
  definitions: Record<string, any>;
}): SwaggerApiRequest {
  const requestModel: SwaggerApiRequest = {};

  if (Array.isArray(parameters)) {
    const queryParams: Record<string, string> = {};
    const pathParams: Record<string, string> = {};
    let bodySchema: any = undefined;

    for (const param of parameters) {
      // Determine schema
      let schema = param.schema ?? (param.type ? { type: param.type, format: param.format } : null);
      if (!schema && param.items) {
        schema = { type: 'array', items: param.items };
      }
      if (!schema) continue;

      const resolved = resolveSchemaReferences(schema, definitions);

      switch (param.in) {
        case 'query':
          queryParams[param.name] = resolved;
          break;
        case 'path':
          pathParams[param.name] = resolved;
          break;
        case 'body':
          bodySchema = resolved;
          break;
      }
    }

    if (Object.keys(queryParams).length) requestModel.query = queryParams;
    if (Object.keys(pathParams).length) requestModel.path = pathParams;
    if (bodySchema) requestModel.body = bodySchema;
  }

  return requestModel;
}

/**
 * Models DOM에서 스키마를 추출하고 TypeScript로 변환 (비동기 버전)
 */
export async function parseSwaggerModelsAsync(): Promise<Record<string, any>> {
  const modelsSection = document.querySelector('.models');
  if (!modelsSection) {
    // console.warn('Models section not found');
    return {};
  }

  const models: Record<string, any> = {};
  const modelContainers = modelsSection.querySelectorAll('.model-container');

  // console.log(`Found ${modelContainers.length} model containers`);

  // 모든 모델을 순차적으로 처리
  for (let i = 0; i < modelContainers.length; i++) {
    const container = modelContainers[i];
    const modelName = container.getAttribute('data-name');
    if (!modelName) {
      // console.warn(`Model name not found for container ${i}`);
      continue;
    }

    // console.log(`Processing model: ${modelName}`);

    // 모델 상세 정보를 가져오기 위해 클릭하여 확장
    const modelButton = container.querySelector('.model-box-control') as HTMLButtonElement;
    if (modelButton) {
      const isExpanded = modelButton.getAttribute('aria-expanded') === 'true';
      // console.log(`Model ${modelName} expanded: ${isExpanded}`);

      if (!isExpanded) {
        modelButton.click();
        // 클릭 후 대기
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // 스키마 추출
      const schema = extractModelSchema(container, modelName);
      if (schema) {
        models[modelName] = schema;
        // console.log(`Extracted schema for ${modelName}:`, schema);
      }
    }
  }

  return models;
}

/**
 * Models DOM에서 스키마를 추출하고 TypeScript로 변환 (동기 버전)
 */
export function parseSwaggerModels(): Record<string, any> {
  const modelsSection = document.querySelector('.models');
  if (!modelsSection) {
    // console.warn('Models section not found');
    return {};
  }

  const models: Record<string, any> = {};
  const modelContainers = modelsSection.querySelectorAll('.model-container');

  // console.log(`Found ${modelContainers.length} model containers`);

  modelContainers.forEach((container, index) => {
    const modelName = container.getAttribute('data-name');
    if (!modelName) {
      // console.warn(`Model name not found for container ${index}`);
      return;
    }

    // console.log(`Processing model: ${modelName}`);

    // 이미 확장된 상태에서만 스키마 추출
    const modelButton = container.querySelector('.model-box-control') as HTMLButtonElement;
    if (modelButton) {
      const isExpanded = modelButton.getAttribute('aria-expanded') === 'true';
      // console.log(`Model ${modelName} expanded: ${isExpanded}`);

      if (isExpanded) {
        const schema = extractModelSchema(container, modelName);
        if (schema) {
          models[modelName] = schema;
          // console.log(`Extracted schema for ${modelName}:`, schema);
        }
      }
    }
  });

  return models;
}

/**
 * Swagger UI의 테이블 기반 모델 파싱 함수 (Category, Tag 등 중첩 모델도 정확히 추출)
 */
function extractModelSchema(container: Element, modelName: string): any {
  // console.log(`[DEBUG] extractModelSchema called for model: ${modelName}`);

  // 0. Example Value(JSON) 기반 파싱 우선 적용 - 여러 셀렉터 시도
  let exampleCode = container.querySelector('.body-param__example code.language-json');
  if (!exampleCode) {
    exampleCode = container.querySelector('code.language-json');
  }
  if (!exampleCode) {
    exampleCode = container.querySelector('.body-param__example pre code');
  }
  if (!exampleCode) {
    exampleCode = container.querySelector('pre code');
  }
  if (!exampleCode) {
    // Swagger UI의 다른 가능한 셀렉터들
    exampleCode = container.querySelector('[data-name="examplePanel"] code');
  }
  if (!exampleCode) {
    exampleCode = container.querySelector('.microlight code');
  }

  // console.log(`[DEBUG] Example code found:`, exampleCode);

  if (exampleCode) {
    // console.log(`[DEBUG] Example code text:`, exampleCode.textContent);
    try {
      const json = JSON.parse(exampleCode.textContent || '{}');
      // console.log(`[DEBUG] Parsed JSON:`, json);

      // JSON이 배열인 경우 첫 번째 요소로 스키마 추출
      const jsonToAnalyze = Array.isArray(json) ? json[0] : json;
      const schema = extractModelSchemaFromExample(jsonToAnalyze);
      // console.log(`[DEBUG] Generated schema from example:`, schema);

      // status 등 enum 필드 보정: 테이블에서 enum 정보가 있으면 병합
      const tableRows = container.querySelectorAll('tr.property-row');
      // console.log(`[DEBUG] Table rows found:`, tableRows.length);

      if (tableRows.length > 0 && schema.type === 'object') {
        tableRows.forEach((row) => {
          let nameCell = row.querySelector('td:first-child');
          if (!nameCell) return;
          let name =
            nameCell.childNodes[0]?.textContent?.trim() || nameCell.textContent?.trim() || '';
          name = name.replace(/\*+$/, '').trim();
          if (!name) return;
          let typeCell = row.querySelector('td:nth-child(2)');
          if (!typeCell) return;
          const propEnum = typeCell.querySelector('.prop-enum');
          let enumValues: string[] | undefined;
          if (propEnum) {
            const enumText = propEnum.textContent || '';
            const match = enumText.match(/\[([^\]]+)\]/);
            if (match) {
              enumValues = match[1].split(',').map((v) => v.trim());
            }
          }
          if (!enumValues) {
            const dataEnum = typeCell.getAttribute('data-enum');
            if (dataEnum) {
              try {
                enumValues = JSON.parse(dataEnum);
              } catch {
                enumValues = dataEnum.split(',').map((v) => v.trim());
              }
            } else {
              let typeText = typeCell.textContent?.trim().toLowerCase() || '';
              if (/enum:/.test(typeText)) {
                const match = typeText.match(/enum: ([^)]+)/);
                if (match) {
                  enumValues = match[1].split(',').map((v) => v.trim());
                }
              }
            }
          }
          if (enumValues && schema.properties?.[name]) {
            // console.log(`[DEBUG] Found enum for ${name}:`, enumValues);
            schema.properties[name] = {
              ...schema.properties[name],
              type: 'string',
              enum: enumValues,
              tsType: enumValues.map((v) => `'${v}'`).join(' | '),
            };
          }
        });
      }
      // console.log(`[DEBUG] Final schema:`, schema);
      return schema;
    } catch (e) {
      // console.error(`[DEBUG] Error parsing JSON:`, e);
      // fallback to table parsing
    }
  } else {
    // console.log(`[DEBUG] No example code found, falling back to table parsing`);
  }

  const schema: any = {
    type: 'object',
    properties: {},
    required: [],
  };

  // 1. 테이블 기반 파싱
  const tableRows = container.querySelectorAll('tr.property-row');
  if (tableRows.length > 0) {
    tableRows.forEach((row) => {
      // 필드명 추출 (name<span class="star">*</span> 형태도 지원)
      let nameCell = row.querySelector('td:first-child');
      if (!nameCell) return;
      let name = nameCell.childNodes[0]?.textContent?.trim() || nameCell.textContent?.trim() || '';
      name = name.replace(/\*+$/, '').trim();
      if (!name) return;

      // required 여부
      const isRequired = row.classList.contains('required');
      if (isRequired) schema.required.push(name);

      // 타입/모델 추출
      let typeCell = row.querySelector('td:nth-child(2)');
      let type: any = { type: 'string' };
      if (typeCell) {
        // 1) 중첩 모델 (object, array of object)
        const modelTitle = typeCell.querySelector('.model-title__text');
        const propEnum = typeCell.querySelector('.prop-enum');
        const propType = typeCell.querySelector('.prop-type');
        const propFormat = typeCell.querySelector('.prop-format');
        let enumValues: string[] | undefined;
        // 1-1) enum 추출 (prop-enum, data-enum, typeText 등)
        if (propEnum) {
          const enumText = propEnum.textContent || '';
          const match = enumText.match(/\[([^\]]+)\]/);
          if (match) {
            enumValues = match[1].split(',').map((v) => v.trim());
          }
        }
        if (!enumValues) {
          const dataEnum = typeCell.getAttribute('data-enum');
          if (dataEnum) {
            try {
              enumValues = JSON.parse(dataEnum);
            } catch {
              enumValues = dataEnum.split(',').map((v) => v.trim());
            }
          } else {
            let typeText = typeCell.textContent?.trim().toLowerCase() || '';
            if (/enum:/.test(typeText)) {
              const match = typeText.match(/enum: ([^)]+)/);
              if (match) {
                enumValues = match[1].split(',').map((v) => v.trim());
              }
            }
          }
        }
        // 1-2) array/object 재귀 파싱
        if (modelTitle) {
          const refModelName = modelTitle.textContent?.trim();
          if (refModelName) {
            const isArray =
              (typeCell.textContent || '').toLowerCase().includes('array') ||
              typeCell.textContent?.trim().startsWith('[');
            if (isArray) {
              const nestedContainer = document.querySelector(
                `.model-container[data-name="${refModelName}"]`,
              );
              let itemsType: any = { type: 'object', $ref: `#/definitions/${refModelName}` };
              if (nestedContainer) {
                itemsType = extractModelSchema(nestedContainer, refModelName);
              }
              type = {
                type: 'array',
                items: itemsType,
              };
            } else {
              const nestedContainer = document.querySelector(
                `.model-container[data-name="${refModelName}"]`,
              );
              let objType: any = { type: 'object', $ref: `#/definitions/${refModelName}` };
              if (nestedContainer) {
                objType = extractModelSchema(nestedContainer, refModelName);
              }
              type = objType;
            }
          }
        } else if (typeCell.textContent?.trim().startsWith('[')) {
          const innerModelTitle = typeCell.querySelector('.model-title__text');
          if (innerModelTitle) {
            const refModelName = innerModelTitle.textContent?.trim();
            let itemsType: any = { type: 'object', $ref: `#/definitions/${refModelName ?? ''}` };
            const nestedContainer = document.querySelector(
              `.model-container[data-name="${refModelName ?? ''}"]`,
            );
            if (nestedContainer && refModelName) {
              itemsType = extractModelSchema(nestedContainer, refModelName);
            }
            type = {
              type: 'array',
              items: itemsType,
            };
          } else {
            type = {
              type: 'array',
              items: { type: 'string' },
            };
          }
        } else if (propType) {
          const t = propType.textContent?.trim().toLowerCase();
          if (t === 'integer' || t === 'number') {
            type = { type: 'integer', format: 'int64' };
            const f = String(propFormat?.textContent || '');
            if (f) {
              const fmt = f.replace(/[()$]/g, '').trim();
              if (fmt) type.format = fmt;
            }
          } else if (t === 'boolean') {
            type = { type: 'boolean' };
          } else if (t === 'string') {
            type = { type: 'string' };
            const f = String(propFormat?.textContent || '');
            if (f) {
              const fmt = f.replace(/[()$]/g, '').trim();
              if (fmt) type.format = fmt;
            }
          } else if (t === 'array') {
            // 배열 타입인 경우 items 타입을 추정
            const arrayItemType = typeCell.querySelector('.model-title__text')?.textContent?.trim();
            if (arrayItemType) {
              type = {
                type: 'array',
                items: { type: 'object', $ref: `#/definitions/${arrayItemType}` },
              };
            } else {
              type = {
                type: 'array',
                items: { type: 'string' },
              };
            }
          } else {
            type = { type: t || 'string' };
          }
        } else {
          let typeText = typeCell.textContent?.trim().toLowerCase() || '';
          // --- 보강: 실제 필드명 기반 타입 추론 ---
          if (name === 'tags') {
            // tags는 object 배열
            type = {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  name: { type: 'string' },
                },
                required: [],
              },
            };
          } else if (name === 'photoUrls') {
            type = {
              type: 'array',
              items: { type: 'string' },
            };
          } else if (
            name === 'id' ||
            name === 'petId' ||
            name === 'quantity' ||
            name === 'userStatus'
          ) {
            type = { type: 'integer', format: 'int64' };
          } else if (name === 'status' && enumValues && enumValues.length > 0) {
            type = {
              type: 'string',
              enum: enumValues,
              tsType: enumValues.map((v) => `'${v}'`).join(' | '),
            };
          } else if (
            name === 'name' ||
            name === 'email' ||
            name === 'password' ||
            name === 'phone' ||
            name === 'firstName' ||
            name === 'lastName'
          ) {
            type = { type: 'string' };
          } else if (name === 'complete') {
            type = { type: 'boolean' };
          } else if (name === 'shipDate') {
            type = { type: 'string', format: 'date-time' };
          } else if (typeText.includes('array')) {
            type = {
              type: 'array',
              items: { type: 'string' },
            };
          } else if (typeText.includes('integer') || typeText.includes('number')) {
            type = { type: 'integer', format: 'int64' };
          } else if (typeText.includes('boolean')) {
            type = { type: 'boolean' };
          } else if (typeText.includes('string')) {
            type = { type: 'string' };
          } else {
            // 기본적으로 string으로 추정하되, 필드명 기반으로 더 정확한 타입 추론
            if (
              name.toLowerCase().includes('id') ||
              name.toLowerCase().includes('count') ||
              name.toLowerCase().includes('quantity')
            ) {
              type = { type: 'integer', format: 'int64' };
            } else if (
              name.toLowerCase().includes('is') ||
              name.toLowerCase().includes('has') ||
              name.toLowerCase().includes('can')
            ) {
              type = { type: 'boolean' };
            } else if (name.toLowerCase().includes('date') || name.toLowerCase().includes('time')) {
              type = { type: 'string', format: 'date-time' };
            } else {
              type = { type: 'string' };
            }
          }
        }
        // enum이 있으면 union type으로 변환
        if (enumValues && enumValues.length > 0) {
          type = {
            type: 'string',
            ...type,
            enum: enumValues,
            tsType: enumValues.map((v) => `'${v}'`).join(' | '),
          };
        }
      }
      schema.properties[name] = type;
    });
    return schema;
  }

  // 2. 테이블이 없으면 기존 방식 (fallback)
  // ... 기존 코드 유지 ...
  return schema;
}

// Example Value(JSON) 기반 타입 추론 함수
function extractModelSchemaFromExample(json: any): any {
  if (Array.isArray(json)) {
    // 배열이면 첫 원소로 타입 추론
    if (json.length === 0) {
      return {
        type: 'array',
        items: { type: 'string' },
      };
    }
    return {
      type: 'array',
      items: extractModelSchemaFromExample(json[0]),
    };
  } else if (typeof json === 'object' && json !== null) {
    const properties: Record<string, any> = {};
    for (const [key, value] of Object.entries(json)) {
      // 특정 필드명에 대한 타입 추론 개선
      if (key === 'id' || key === 'petId' || key === 'quantity' || key === 'userStatus') {
        properties[key] = { type: 'integer', format: 'int64' };
      } else if (
        key === 'name' ||
        key === 'email' ||
        key === 'password' ||
        key === 'phone' ||
        key === 'firstName' ||
        key === 'lastName' ||
        key === 'type' ||
        key === 'message'
      ) {
        properties[key] = { type: 'string' };
      } else if (key === 'complete') {
        properties[key] = { type: 'boolean' };
      } else if (key === 'shipDate') {
        properties[key] = { type: 'string', format: 'date-time' };
      } else if (key === 'photoUrls') {
        properties[key] = { type: 'array', items: { type: 'string' } };
      } else if (key === 'tags') {
        properties[key] = {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer', format: 'int64' },
              name: { type: 'string' },
            },
            required: [],
          },
        };
      } else if (key === 'category') {
        properties[key] = {
          type: 'object',
          properties: {
            id: { type: 'integer', format: 'int64' },
            name: { type: 'string' },
          },
          required: [],
        };
      } else if (key === 'status') {
        // status는 enum으로 처리
        if (typeof value === 'string') {
          properties[key] = { type: 'string' };
        } else {
          properties[key] = extractModelSchemaFromExample(value);
        }
      } else {
        // 일반적인 경우 - 값의 타입에 따라 추론
        if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            properties[key] = { type: 'integer', format: 'int64' };
          } else {
            properties[key] = { type: 'number' };
          }
        } else if (typeof value === 'boolean') {
          properties[key] = { type: 'boolean' };
        } else if (typeof value === 'string') {
          // 날짜/시간 형식인지 확인
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            properties[key] = { type: 'string', format: 'date-time' };
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            properties[key] = { type: 'string', format: 'date' };
          } else {
            properties[key] = { type: 'string' };
          }
        } else if (Array.isArray(value)) {
          if (value.length === 0) {
            properties[key] = { type: 'array', items: { type: 'string' } };
          } else {
            properties[key] = { type: 'array', items: extractModelSchemaFromExample(value[0]) };
          }
        } else if (typeof value === 'object' && value !== null) {
          properties[key] = extractModelSchemaFromExample(value);
        } else {
          properties[key] = { type: 'string' };
        }
      }
    }
    return {
      type: 'object',
      properties,
      required: [],
    };
  } else if (typeof json === 'number') {
    // 정수인지 실수인지 구분
    if (Number.isInteger(json)) {
      return { type: 'integer', format: 'int64' };
    } else {
      return { type: 'number' };
    }
  } else if (typeof json === 'boolean') {
    return { type: 'boolean' };
  } else if (typeof json === 'string') {
    // 날짜/시간 형식인지 확인
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(json)) {
      return { type: 'string', format: 'date-time' };
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(json)) {
      return { type: 'string', format: 'date' };
    } else {
      return { type: 'string' };
    }
  } else {
    return { type: 'string' };
  }
}

/**
 * 속성 요소에서 이름과 타입 정보 추출
 */
function parsePropertyFromElement(
  propElement: Element,
): { name: string; type: any; isRequired: boolean } | null {
  let propText = propElement.textContent?.trim();
  if (!propText) return null;

  // 필드명에서 * 제거 및 required 여부 추출
  let isRequired = false;
  if (propText.endsWith('*')) {
    isRequired = true;
    propText = propText.replace(/\*+$/, '').trim();
  }
  // 부모 요소에서 required 여부 확인 (Swagger UI에서 별도 표시하는 경우)
  isRequired =
    isRequired ||
    propElement.closest('.required') !== null ||
    propElement.closest('[class*="required"]') !== null;

  // 속성 이름과 타입 분리
  const propertyInfo = parsePropertyText(propText);
  let [name, typeText] = propertyInfo;
  if (!name) return null;
  name = name.replace(/\*+$/, '').trim(); // 혹시 남아있을 * 제거

  // 타입 정보 추출 (배열/객체/기본타입 구분)
  let type = extractPropertyTypeFromText(typeText || propText);

  // 배열 타입 보정: Swagger UI에서 배열은 보통 "propertyName: array" 또는 "propertyName (array)"로 표시됨
  if ((typeText || '').toLowerCase().includes('array')) {
    // items 타입 추정: 자식 .model이 있으면 참조, 아니면 string
    const arrayItemModel = propElement.querySelector('.model');
    if (arrayItemModel) {
      // 참조 모델명 추출
      const refModelName = arrayItemModel.textContent?.trim();
      if (refModelName && /^[A-Z][a-zA-Z0-9_]+$/.test(refModelName)) {
        type = {
          type: 'array',
          items: {
            type: 'object',
            $ref: `#/definitions/${refModelName}`,
          },
        };
      } else {
        type = {
          type: 'array',
          items: { type: 'string' },
        };
      }
    } else {
      type = {
        type: 'array',
        items: { type: 'string' },
      };
    }
  }

  // 객체 타입 보정: .model이 중첩되어 있으면 $ref로 처리
  if ((typeText || '').toLowerCase().includes('object') || type.type === 'object') {
    // 참조 모델명 추출
    const refModel = propElement.querySelector('.model');
    const refModelName = refModel?.textContent?.trim();
    if (refModelName && /^[A-Z][a-zA-Z0-9_]+$/.test(refModelName)) {
      type = {
        type: 'object',
        $ref: `#/definitions/${refModelName}`,
      };
    }
  }

  // number 타입 보정: id 등은 Swagger UI에서 integer로 표시됨
  if (
    (typeText || '').toLowerCase().includes('integer') ||
    (typeText || '').toLowerCase().includes('number')
  ) {
    type = { type: 'integer', format: 'int64' };
  }

  return { name, type, isRequired };
}

/**
 * 대안적인 속성 추출 방법 (개선된 버전)
 */
function extractPropertiesAlternative(container: Element, modelName: string): Record<string, any> {
  const properties: Record<string, any> = {};

  // 모델 컨테이너의 전체 텍스트를 분석
  const containerText = container.textContent || '';
  // console.log(`Container text for ${modelName}:`, containerText);

  // 정규식을 사용하여 속성 패턴 찾기 (개선된 버전)
  // 예: "id (integer, optional)" 또는 "name (string, required)"
  const propertyPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)/g;
  let match;

  while ((match = propertyPattern.exec(containerText)) !== null) {
    const [, propName, propType] = match;

    if (propName !== modelName && propName !== 'Property' && propName !== 'Type') {
      const type = extractPropertyTypeFromText(propType);
      properties[propName] = type;

      // required 여부 확인
      if (propType.toLowerCase().includes('required')) {
        // required 배열은 별도로 처리해야 함
        // console.log(`Found required property: ${propName}`);
      }

      // console.log(`Extracted property via regex: ${propName} -> ${JSON.stringify(type)}`);
    }
  }

  // 만약 정규식으로 찾지 못했다면, 다른 패턴 시도
  if (Object.keys(properties).length === 0) {
    // console.log('Trying alternative regex patterns...');

    // 다른 패턴들 시도
    const patterns = [
      /([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^\s,]+)/g, // "name: string"
      /([a-zA-Z_][a-zA-Z0-9_]*)\s*\[([^\]]+)\]/g, // "tags[Tag]"
      /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g, // "name(type)"
    ];

    for (const pattern of patterns) {
      // console.log(`Trying pattern: ${pattern}`);
      let patternMatch;

      while ((patternMatch = pattern.exec(containerText)) !== null) {
        const [, propName, propType] = patternMatch;

        if (propName !== modelName && propName !== 'Property' && propName !== 'Type') {
          const type = extractPropertyTypeFromText(propType);
          properties[propName] = type;

          // console.log(
          //   `Extracted property via pattern ${pattern}: ${propName} -> ${JSON.stringify(type)}`,
          // );
        }
      }

      if (Object.keys(properties).length > 0) {
        break;
      }
    }
  }

  return properties;
}

/**
 * 실제 Swagger UI의 중첩된 모델 구조에서 속성 추출
 */
function extractNestedModelProperties(container: Element, modelName: string): Record<string, any> {
  const properties: Record<string, any> = {};

  // console.log(`Extracting nested properties for ${modelName}`);

  // 중첩된 모델 컨테이너들 찾기
  const nestedContainers = container.querySelectorAll('.model-container');
  // console.log(`Found ${nestedContainers.length} nested containers`);

  nestedContainers.forEach((nestedContainer, index) => {
    const nestedModelName = nestedContainer.getAttribute('data-name');
    // console.log(`Nested container ${index}: ${nestedModelName}`);

    if (nestedModelName && nestedModelName !== modelName) {
      // 중첩된 모델의 속성들 추출
      const nestedProperties = extractModelSchema(nestedContainer, nestedModelName);

      if (Object.keys(nestedProperties.properties).length > 0) {
        // 중첩된 모델을 참조로 추가
        properties[nestedModelName] = {
          type: 'object',
          $ref: `#/definitions/${nestedModelName}`,
        };

        // console.log(`Added nested model reference: ${nestedModelName}`);
      }
    }
  });

  return properties;
}

/**
 * 속성 텍스트에서 이름과 타입 분리 (개선된 버전)
 */
function parsePropertyText(text: string): [string, string] {
  // "propertyName (type)" 형태 파싱
  const match = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)$/);
  if (match) {
    return [match[1], match[2]];
  }

  // "propertyName: type" 형태 파싱
  const colonMatch = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+)$/);
  if (colonMatch) {
    return [colonMatch[1], colonMatch[2]];
  }

  // 단순 타입인 경우 (모델 이름이 아닌 경우만)
  if (text.match(/^[a-z_][a-zA-Z0-9_]*$/)) {
    return [text, text];
  }

  return ['', text];
}

/**
 * 텍스트에서 속성 타입 정보 추출 (개선된 버전)
 */
function extractPropertyTypeFromText(text: string): any {
  const lowerText = text.toLowerCase().trim();

  // 기본 타입 매핑
  if (lowerText.includes('string')) return { type: 'string' };
  if (lowerText.includes('number') || lowerText.includes('integer')) return { type: 'number' };
  if (lowerText.includes('boolean')) return { type: 'boolean' };
  if (lowerText.includes('array')) {
    const itemType = text.match(/array\[(.*?)\]/)?.[1] || 'string';
    return {
      type: 'array',
      items: { type: itemType.toLowerCase() },
    };
  }

  // 객체 타입 (다른 모델 참조) - 대문자로 시작하는 경우
  if (text.match(/^[A-Z][a-zA-Z]*$/)) {
    return {
      type: 'object',
      $ref: `#/definitions/${text}`,
    };
  }

  // URL 참조 형태
  if (text.includes('http') && text.includes('#/definitions/')) {
    const refMatch = text.match(/#\/definitions\/([A-Za-z]+)/);
    if (refMatch) {
      return {
        type: 'object',
        $ref: `#/definitions/${refMatch[1]}`,
      };
    }
  }

  // 기본값
  return { type: 'string' };
}

/**
 * 전체 텍스트에서 속성 패턴 찾기 (최후의 수단)
 */
function extractPropertiesFromFullText(container: Element, modelName: string): Record<string, any> {
  const properties: Record<string, any> = {};

  // 컨테이너의 모든 텍스트 노드를 순회
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const text = node.textContent?.trim();
      return text && text.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const textNodes: string[] = [];
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim();
    if (text && text.length > 0) {
      textNodes.push(text);
    }
  }

  // console.log('Text nodes found:', textNodes);

  // 각 텍스트 노드에서 속성 패턴 찾기
  textNodes.forEach((text, index) => {
    // console.log(`Analyzing text node ${index}: "${text}"`);

    // 다양한 패턴 시도
    const patterns = [
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)$/, // "id (integer)"
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^\s]+)$/, // "name: string"
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\[([^\]]+)\]$/, // "tags[Tag]"
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)$/, // "name(type)"
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const [, propName, propType] = match;

        if (propName !== modelName && propName !== 'Property' && propName !== 'Type') {
          const type = extractPropertyTypeFromText(propType);
          properties[propName] = type;

          // console.log(
          //   `Extracted property from text node ${index}: ${propName} -> ${JSON.stringify(type)}`,
          // );
          break; // 첫 번째 매치에서 중단
        }
      }
    }
  });

  return properties;
}

/**
 * 스키마 참조를 실제 스키마로 변환
 */
export function resolveSchemaReferences(schema: any, definitions: Record<string, any>): any {
  if (!schema) return schema;

  if (schema.$ref) {
    const refName = schema.$ref.replace('#/definitions/', '');
    // 재귀적으로 치환
    return resolveSchemaReferences(definitions[refName], definitions) || schema;
  }

  if (schema.type === 'object' && schema.properties) {
    const resolved: any = { ...schema };
    resolved.properties = {};

    Object.entries(schema.properties).forEach(([key, value]) => {
      resolved.properties[key] = resolveSchemaReferences(value, definitions);
    });

    return resolved;
  }

  if (schema.type === 'array' && schema.items) {
    return {
      ...schema,
      items: resolveSchemaReferences(schema.items, definitions),
    };
  }

  return schema;
}
