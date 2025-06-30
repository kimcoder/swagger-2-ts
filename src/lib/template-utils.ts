import type { SwaggerApi } from '@/types/swagger';

export const DEFAULT_TEMPLATES = {
  basic: `// {{summary}}
export interface {{functionName}}Request {
{{requestInterface}}
}

export interface {{functionName}}Response {
{{responseInterface}}
}

export const {{functionName}} = async (params: {{functionName}}Request): Promise<{{functionName}}Response> => {
  // Your implementation – {{method}} {{path}}
};`,

  reactQuery: `// {{summary}} – React Query
import { useQuery } from '@tanstack/react-query';

export interface {{functionName}}Request {
{{requestInterface}}
}

export const use{{functionName}} = (params: {{functionName}}Request) =>
  useQuery({ queryKey: ['{{operationId}}', params], queryFn: () => {{functionName}}(params) });

export const {{functionName}} = async (params: {{functionName}}Request) => {
  // {{method}} {{path}}
};`,

  swr: `// {{summary}} – SWR
import useSWR from 'swr';

export interface {{functionName}}Request {
{{requestInterface}}
}

export const use{{functionName}} = (params: {{functionName}}Request) =>
  useSWR(['{{operationId}}', params], () => {{functionName}}(params));

export const {{functionName}} = async (params: {{functionName}}Request) => {
  // {{method}} {{path}}
};`,

  superagent: `// {{summary}} – SuperAgent
import request from 'superagent';

export interface {{functionName}}Request {
{{requestInterface}}
}

export const {{functionName}} = async (params: {{functionName}}Request) => {
  {{superagentImplementation}}
};`,
} as const;

/**
 * Replace handlebars in template with generated pieces
 */
export const generateCustomTemplate = (
  endpoints: SwaggerApi[],
  rawTemplate: string,
  requestBodyGen: (e: SwaggerApi) => string,
  responseBodyGen: (e: SwaggerApi) => string,
  implGen: (e: SwaggerApi) => string,
  fnNameGen: (m: string, p: string, o?: string) => string,
  cap: (s: string) => string,
) =>
  endpoints
    .map((ep) => {
      const fnName = cap(fnNameGen(ep.method, ep.path, ep.operationId));
      return rawTemplate
        .replace(/\{\{functionName\}\}/g, fnName)
        .replace(/\{\{method\}\}/g, ep.method)
        .replace(/\{\{path\}\}/g, ep.path)
        .replace(/\{\{summary\}\}/g, ep.summary)
        .replace(/\{\{description\}\}/g, ep.description || '')
        .replace(/\{\{operationId\}\}/g, ep.operationId)
        .replace(/\{\{requestInterface\}\}/g, requestBodyGen(ep))
        .replace(/\{\{responseInterface\}\}/g, responseBodyGen(ep))
        .replace(/\{\{parameters\}\}/g, JSON.stringify(ep.parameters, null, 2))
        .replace(/\{\{tags\}\}/g, ep.tags.join(', '))
        .replace(/\{\{superagentImplementation\}\}/g, implGen(ep));
    })
    .join('\n\n');
