import { CaseConverter } from '@/lib/case-converter';
import { SwaggerApi } from '@/types/swagger';
import { BaseCodeGenerationStrategy } from './base-strategy';

export class SuperagentStrategy extends BaseCodeGenerationStrategy {
  readonly type = 'superagent' as const;

  protected getHeader() {
    return `// Generated with SuperAgent
import request from 'superagent';`;
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

    impl += this.indent(`const req = request.${endpoint.method.toLowerCase()}(url);`) + '\n';

    // query
    if (queryParams.length) {
      impl += this.indent(`if (params.query) req.query(params.query);`) + '\n';
    }

    // headers
    if (headerParams.length) {
      impl += this.indent(`if (params.headers) req.set(params.headers);`) + '\n';
    }

    // body
    if (bodyParams.length) {
      impl += this.indent(`if (params.body) req.send(params.body);`) + '\n';
    } else if (formParams.length) {
      impl +=
        this.indent(`if (params.formData) {
  Object.entries(params.formData).forEach(([k,v]) => {
    if (v !== undefined) {
      if (v instanceof File) req.attach(k, v);
      else req.field(k, String(v as any));
    }
  });
}`) + '\n';
    }

    impl +=
      this.indent(`const res = await req;
return { data: res.body, status: res.status, statusText: res.statusText };`) + '\n}';

    return impl;
  }
}
