import { CaseConverter } from '@/lib/case-converter';
import { SwaggerApi } from '@/types/swagger';
import { BaseCodeGenerationStrategy } from './base-strategy';

export class AxiosStrategy extends BaseCodeGenerationStrategy {
  readonly type = 'axios' as const;

  protected getHeader() {
    return `// Generated with Axios
import axios, { AxiosResponse } from 'axios';`;
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

    impl += this.indent(`const cfg: any = {};`) + '\n';
    if (queryParams.length) impl += this.indent(`cfg.params = params.query;`) + '\n';
    if (headerParams.length) impl += this.indent(`cfg.headers = params.headers;`) + '\n\n';

    let dataVar = 'undefined';
    if (bodyParams.length) dataVar = 'params.body';
    else if (formParams.length) {
      impl +=
        this.indent(`const fd = new FormData();
if(params.formData){
  Object.entries(params.formData).forEach(([k,v])=>v!==undefined&&fd.append(k, v instanceof File ? v : String(v as any)));
}`) + '\n\n';
      dataVar = 'fd';
    }

    impl +=
      this
        .indent(`const res: AxiosResponse<${interfaceName}Response> = await api.${endpoint.method.toLowerCase()}(url, ${dataVar}, cfg);
return { data: res.data, status: res.status, statusText: res.statusText };`) + '\n}';

    return impl;
  }
}
