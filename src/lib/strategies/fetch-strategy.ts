import { CaseConverter } from '@/lib/case-converter';
import { SwaggerApi } from '@/types/swagger';
import { BaseCodeGenerationStrategy } from './base-strategy';

export class FetchStrategy extends BaseCodeGenerationStrategy {
  readonly type = 'fetch' as const;

  protected getHeader() {
    return `// Generated with Fetch`;
  }

  public generateImplementation(endpoint: SwaggerApi) {
    const {
      pathParams,
      queryParams,
      bodyParams,
      formData: formParams,
      headerParams,
    } = this.groupParameters(endpoint);

    const functionName = this.generateFunctionName(
      endpoint.method,
      endpoint.path,
      endpoint.operationId,
    );
    const interfaceName = this.capitalize(functionName);

    // 1) URL 조립
    let urlLine = `let url = \`\${API_BASE_URL}${endpoint.path}\`;`;
    pathParams.forEach((p) => {
      const paramName = CaseConverter.convertCase(p.name, this.options.propertyNameCase);
      urlLine = urlLine.replace(`{${p.name}}`, `\${params.${paramName}}`);
    });

    let impl = `export async function ${functionName}(params: ${interfaceName}Request): Promise<${interfaceName}Response> {\n`;
    impl += this.indent(urlLine) + '\n\n';

    // 2) Query 직렬화
    if (queryParams.length) {
      impl +=
        this.indent(`if (params.query) {
  const sp = new URLSearchParams();
  Object.entries(params.query).forEach(([k, v]) => {
    if (Array.isArray(v)) sp.append(k, v.join(','));
    else if (v !== undefined) sp.append(k, String(v));
  });
  url += \`?\${sp.toString()}\`;
}`) + '\n\n';
    }

    // 3) Headers
    impl += this.indent(`const headers: Record<string, string> = {};`) + '\n';
    if (bodyParams.length)
      impl += this.indent(`headers['Content-Type'] = 'application/json';`) + '\n';
    impl += this.indent(`if (params.headers) Object.assign(headers, params.headers);`) + '\n\n';

    // 4) Body/FormData 설정
    let bodyLine = '';
    if (bodyParams.length) bodyLine = 'body: JSON.stringify(params.body),';
    else if (formParams.length)
      bodyLine = `body: (() => {
  const fd = new FormData();
  if (params.formData) {
    Object.entries(params.formData).forEach(([k, v]) => {
      if (v !== undefined) fd.append(k, v instanceof File ? v : String(v));
    });
  }
  return fd;
})(),`;

    // 5) 호출 & flatten 반환
    impl +=
      this.indent(`const res = await fetch(url, {
  method: '${endpoint.method}',
  headers,
  ${bodyLine}
});
if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
return await res.json();`) + '\n}';

    return impl;
  }
}
