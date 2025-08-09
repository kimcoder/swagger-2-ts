import { CaseConverter } from '@/lib/case-converter';
import { SwaggerApi } from '@/types/swagger';
import { BaseCodeGenerationStrategy } from './base-strategy';

export class AxiosStrategy extends BaseCodeGenerationStrategy {
  readonly type = 'axios' as const;

  protected getHeader() {
    return `// Generated with Axios
import axios from 'axios';`;
  }

  protected generateConfigSection(): string {
    return (
      super.generateConfigSection() +
      `
const api = axios.create({
  baseURL: API_BASE_URL,
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

    const functionName = this.generateFunctionName(
      endpoint.method,
      endpoint.path,
      endpoint.operationId,
    );
    const interfaceName = this.capitalize(functionName);

    // 1) URL 조립
    let urlLine = `let url = \`\${endpoint.path}\`;`;
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

    // 3) Axios config (headers)
    impl += this.indent(`const cfg: any = {};`) + '\n';
    if (headerParams.length) {
      impl += this.indent(`Object.assign(cfg.headers ??= {}, params.headers);`) + '\n';
    }

    // 4) Body/FormData 준비
    let dataArg = 'undefined';
    if (bodyParams.length) {
      dataArg = 'params.body';
    } else if (formParams.length) {
      impl +=
        this.indent(`const fd = new FormData();
if (params.formData) {
  Object.entries(params.formData).forEach(([k, v]) => {
    if (v !== undefined) fd.append(k, v instanceof File ? v : String(v));
  });
}`) + '\n\n';
      dataArg = 'fd';
    }

    // 5) 실제 호출 & flatten 반환
    impl +=
      this.indent(`const res = await api.${endpoint.method.toLowerCase()}(url, ${dataArg}, cfg);
return res.data;`) + '\n}';

    return impl;
  }
}
