import { CaseConverter } from '@/lib/case-converter';
import type { ApiEndpoint } from '@/types/api';
import { BaseCodeGenerationStrategy } from './base-strategy';

export class FetchStrategy extends BaseCodeGenerationStrategy {
  readonly type = 'fetch' as const;

  protected getHeader() {
    return `// Generated with Fetch`;
  }

  protected getSwaggerDocument(): any {
    try {
      // 1. window 객체에서 찾기
      const windowAny = window as any;
      const possibleProps = ['swaggerSpec', '__SWAGGER_SPEC__', '__API_SPEC__', 'spec'];

      for (const prop of possibleProps) {
        if (windowAny[prop]) {
          console.log(`[DEBUG] Found swagger document in window.${prop}`);
          return windowAny[prop];
        }
      }

      // 2. 페이지 내 스크립트 태그에서 찾기
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        try {
          if (script.type === 'application/json' || !script.type) {
            const content = JSON.parse(script.textContent || '');
            if (content.swagger || content.openapi) {
              console.log('[DEBUG] Found swagger document in script tag');
              return content;
            }
          }
        } catch (e) {
          // JSON 파싱 실패는 조용히 넘어감
        }
      }

      // 3. Swagger UI의 data 속성에서 찾기
      const swaggerUI = document.querySelector('[data-url]');
      if (swaggerUI) {
        const dataUrl = swaggerUI.getAttribute('data-url');
        if (dataUrl) {
          console.log(`[DEBUG] Found swagger UI with data-url: ${dataUrl}`);
          // 여기서는 URL만 찾고, 실제 fetch는 비동기이므로 동기적으로는 처리할 수 없음
        }
      }

      // 4. 페이지 내 숨겨진 요소에서 찾기
      const hiddenElements = document.querySelectorAll('[style*="display: none"], [hidden]');
      for (const element of hiddenElements) {
        try {
          const text = element.textContent;
          if (text && (text.includes('"swagger"') || text.includes('"openapi"'))) {
            const content = JSON.parse(text);
            if (content.swagger || content.openapi) {
              console.log('[DEBUG] Found swagger document in hidden element');
              return content;
            }
          }
        } catch (e) {
          // JSON 파싱 실패는 조용히 넘어감
        }
      }

      console.log('[DEBUG] No swagger document found');
      return null;
    } catch (error) {
      console.error('[DEBUG] Error in getSwaggerDocument:', error);
      return null;
    }
  }

  public generateImplementation(endpoint: ApiEndpoint) {
    const {
      pathParams,
      queryParams,
      bodyParams,
      formData: formParams,
      headerParams,
    } = this.groupParameters(endpoint);

    // Generate function name with proper case conversion
    const functionName = this.generateFunctionName(
      endpoint.method,
      endpoint.path,
      endpoint.operationId,
    );
    const interfaceName = this.capitalize(functionName);

    // build url using the API_BASE_URL constant
    let url = `let url = \`\${API_BASE_URL}${endpoint.path}\`;`;
    pathParams.forEach((p) => {
      const paramName = CaseConverter.convertCase(p.name, this.options.propertyNameCase);
      url = url.replace(`{${p.name}}`, `\${params.${paramName}}`);
    });

    let impl = `export async function ${functionName}(params: ${interfaceName}Request): Promise<${interfaceName}Response> {\n`;
    impl += this.indent(url) + '\n\n';

    // query
    if (queryParams.length) {
      impl +=
        this.indent(`if (params.query) {
  const sp = new URLSearchParams();
  Object.entries(params.query).forEach(([k,v]) => {
    if (Array.isArray(v)) v.forEach(t=>sp.append(k,String(t)))
    else if (v!==undefined) sp.append(k,String(v))
  });
  url += \`?\${sp.toString()}\`;
}`) + '\n\n';
    }

    // headers
    impl += this.indent(`const headers: Record<string, string> = {};`) + '\n';
    if (bodyParams.length)
      impl += this.indent(`headers['Content-Type'] = 'application/json';`) + '\n';
    impl += this.indent(`if (params.headers) Object.assign(headers, params.headers);`) + '\n\n';

    // body
    let bodyLine = '';
    if (bodyParams.length) bodyLine = 'body: JSON.stringify(params.body),';
    else if (formParams.length)
      bodyLine = `body: (()=>{const fd=new FormData();if(params.formData){Object.entries(params.formData).forEach(([k,v])=>v!==undefined&&fd.append(k, v instanceof File ? v : String(v as any)));}return fd;})(),`;

    impl +=
      this.indent(`const res = await fetch(url, {
  method: '${endpoint.method}',
  headers,
  ${bodyLine}
});
if(!res.ok) throw new Error(\`HTTP \${res.status}\`);
const data = await res.json();
return { data, status: res.status, statusText: res.statusText, headers: res.headers };`) + '\n}';

    return impl;
  }
}
