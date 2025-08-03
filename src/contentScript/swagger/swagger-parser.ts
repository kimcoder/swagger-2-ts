import {
  SwaggerApi,
  SwaggerApiRequest,
  SwaggerOperation,
  SwaggerParameter,
  SwaggerSchema,
} from '@/types/swagger';
import { findSwaggerDocument } from './swagger-finder';

/**
 * 스웨거 문서를 읽어 SwaggerApi[] 배열로 변환합니다.
 */
export async function getAPIList(): Promise<SwaggerApi[]> {
  const swaggerDoc = await findSwaggerDocument();
  if (!swaggerDoc) {
    throw new Error('No Swagger/OpenAPI document found');
  }

  // Swagger 2.0 의 definitions + OpenAPI 3.x 의 components.schemas
  const definitions: Record<string, SwaggerSchema> = {
    ...(swaggerDoc.definitions || {}),
    ...(swaggerDoc.components?.schemas || {}),
  };

  const apiList: SwaggerApi[] = [];
  const paths = swaggerDoc.paths || {};

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [method, rawOp] of Object.entries(pathItem as Record<string, any>)) {
      if (method.toLowerCase() === 'parameters') continue;
      const operation = rawOp as SwaggerOperation;

      // === 1) 파라미터 통합 처리 ===
      const parameters: SwaggerParameter[] = (operation.parameters || []).map((param) => {
        // 원본 복제
        const p: SwaggerParameter = { ...param };

        // rawSchema 결합: Swagger2의 param.schema, type/format/enum/items
        let rawSchema: any = null;
        if (param.schema) {
          rawSchema = param.schema;
        } else if (param.type) {
          rawSchema = { type: param.type };
          if (param.format) rawSchema.format = param.format;
          if (param.enum) rawSchema.enum = param.enum;
          if (param.items) rawSchema.items = param.items;
          // collectionFormat 처리 시 특별히 다루고 싶은 경우 여기에 추가 가능
        } else if (param.items) {
          rawSchema = { type: 'array', items: param.items };
        }

        // 스키마가 있으면 재귀 해석
        if (rawSchema) {
          p.schema = resolveSchema(rawSchema, definitions);
        }

        // 불필요해진 필드 제거
        delete (p as any).type;
        delete (p as any).format;
        delete (p as any).items;
        delete (p as any).enum;
        delete (p as any).collectionFormat;

        return p;
      });

      // === 2) 응답 스키마 해석 ===
      const response = getResponseSchema(operation, definitions);

      // === 3) API 목록에 추가 ===
      apiList.push({
        id: operation.operationId || `${method.toUpperCase()}_${path}`,
        method: method.toUpperCase(),
        path,
        summary: operation.summary || '',
        description: operation.description,
        operationId: operation.operationId || '',
        tags: operation.tags || [],
        parameters,
        response,
        // requestBody는 OpenAPI 3.x 전용
        requestBody: operation.requestBody,
        // getRequestModel은 swaggerApi.request로 들어가지만,
        // 현재 BaseCodeGenerationStrategy는 parameters만 참고합니다.
        request: getRequestModel(parameters, operation.requestBody, definitions),
      });
    }
  }

  return apiList;
}

/**
 * SwaggerOperation.responses 를 순회하며
 * - Swagger 2.0: response.schema
 * - OpenAPI 3.x: response.content['application/json'].schema
 * 를 resolveSchema로 재귀 치환하여 반환합니다.
 */
function getResponseSchema(
  operation: SwaggerOperation,
  definitions: Record<string, SwaggerSchema>,
): Record<string, any> {
  const out: Record<string, any> = {};

  for (const [statusCode, resp] of Object.entries(operation.responses || {})) {
    let rawSchema: any = null;

    // Swagger 2.0
    if ((resp as any).schema) {
      rawSchema = (resp as any).schema;
    }
    // OpenAPI 3.x
    else if ((resp as any).content && (resp as any).content['application/json']?.schema) {
      rawSchema = (resp as any).content['application/json'].schema;
    }

    out[statusCode] = {
      description: (resp as any).description || '',
      headers: (resp as any).headers || {},
      response: rawSchema ? resolveSchema(rawSchema, definitions) : null,
    };
  }

  return out;
}

/**
 * 파라미터 배열 + OpenAPI 3.x requestBody 를 통합하여
 * SwaggerApiRequest 형태로 반환합니다.
 */
function getRequestModel(
  parameters: SwaggerParameter[] = [],
  requestBody: any,
  definitions: Record<string, SwaggerSchema>,
): SwaggerApiRequest {
  const model: SwaggerApiRequest = {};

  // 1) parameters 처리
  for (const param of parameters) {
    if (!param.schema) continue;
    switch (param.in) {
      case 'path':
        model.path = { ...(model.path || {}), [param.name]: param.schema };
        break;
      case 'query':
        model.query = { ...(model.query || {}), [param.name]: param.schema };
        break;
      case 'header':
        model.headers = { ...(model.headers || {}), [param.name]: param.schema };
        break;
      case 'cookie':
        model.cookies = { ...(model.cookies || {}), [param.name]: param.schema };
        break;
      case 'formData':
        model.formData = { ...(model.formData || {}), [param.name]: param.schema };
        break;
      case 'body':
        model.body = param.schema;
        break;
    }
  }

  // 2) OpenAPI 3.x requestBody 처리 (JSON / multipart)
  if (requestBody?.content) {
    const jsonSchema = requestBody.content['application/json']?.schema;
    if (jsonSchema) {
      model.body = resolveSchema(jsonSchema, definitions);
    }
    const formSchema = requestBody.content['multipart/form-data']?.schema;
    if (formSchema) {
      model.formData = resolveSchema(formSchema, definitions);
    }
  }

  return model;
}

/**
 * $ref, array, object, primitive 타입을 재귀적으로 치환합니다.
 */
function resolveSchema(schema: any, definitions: Record<string, SwaggerSchema>): any {
  if (!schema) return null;

  // 1) $ref
  if (schema.$ref) {
    const parts = schema.$ref.split('/');
    const refName = parts[parts.length - 1];
    const def = definitions[refName];
    return def ? resolveSchema(def, definitions) : null;
  }

  // 2) 배열
  if (schema.type === 'array' && schema.items) {
    return {
      type: 'array',
      items: resolveSchema(schema.items, definitions),
      // collectionFormat 등 필요시 추가
    };
  }

  // 3) 객체
  if (schema.type === 'object' || schema.properties) {
    const props: Record<string, any> = {};
    for (const [key, val] of Object.entries(schema.properties || {})) {
      props[key] = resolveSchema(val, definitions);
    }
    return {
      type: 'object',
      properties: props,
      required: schema.required || [],
    };
  }

  // 4) primitive
  const out: any = { type: schema.type };
  if (schema.format) out.format = schema.format;
  if (schema.enum) out.enum = schema.enum;
  return out;
}
