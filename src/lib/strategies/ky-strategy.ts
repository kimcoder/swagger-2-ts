import { CaseConverter } from '@/lib/case-converter';
import { SwaggerApi } from '@/types/swagger';
import { BaseCodeGenerationStrategy } from './base-strategy';

export class KyStrategy extends BaseCodeGenerationStrategy {
  readonly type = 'ky' as const;

  protected getHeader() {
    return `// Generated with Ky
import ky from 'ky';`;
  }

  protected generateConfigSection(): string {
    return (
      super.generateConfigSection() +
      `
const api = ky.create({
  prefixUrl: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});
`
    );
  }

  public generateImplementation(endpoint: SwaggerApi) {
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

    let url = `let url = \`${endpoint.path}\`;`;
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
    if (bodyParams.length) bodyLine = 'json: params.body,';
    else if (formParams.length)
      bodyLine = `body: (()=>{const fd=new FormData();if(params.formData){Object.entries(params.formData).forEach(([k,v])=>v!==undefined&&fd.append(k, v instanceof File ? v : String(v as any)));}return fd;})(),`;

    impl +=
      this.indent(`const res = await ky.${endpoint.method.toLowerCase()}(url, {
  headers,
  ${bodyLine}
});
const data = await res.json();
return { data, status: res.status, statusText: res.statusText };`) + '\n}';

    return impl;
  }
}
