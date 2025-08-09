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

    const functionName = this.generateFunctionName(
      endpoint.method,
      endpoint.path,
      endpoint.operationId,
    );
    const interfaceName = this.capitalize(functionName);

    // 1) URL 조립
    let urlLine = `let url = \`${endpoint.path}\`;`;
    pathParams.forEach((p) => {
      const paramName = CaseConverter.convertCase(p.name, this.options.propertyNameCase);
      urlLine = urlLine.replace(`{${p.name}}`, `\${params.${paramName}}`);
    });

    let impl = `export async function ${functionName}(params: ${interfaceName}Request): Promise<${interfaceName}Response> {\n`;
    impl += this.indent(urlLine) + '\n\n';

    // 2) Query 직렬화 (superagent.query 대신 수동 URL 포함)
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

    // 3) 요청 빌드
    impl += this.indent(`const req = request.${endpoint.method.toLowerCase()}(url);`) + '\n';

    // 4) Headers
    if (headerParams.length) {
      impl += this.indent(`if (params.headers) req.set(params.headers);`) + '\n';
    }

    // 5) Body/FormData
    if (bodyParams.length) {
      impl += this.indent(`if (params.body) req.send(params.body);`) + '\n';
    } else if (formParams.length) {
      impl +=
        this.indent(`if (params.formData) {
  Object.entries(params.formData).forEach(([k, v]) => {
    if (v !== undefined) {
      if (v instanceof File) req.attach(k, v);
      else req.field(k, String(v));
    }
  });
}`) + '\n';
    }

    // 6) 호출 & flatten 반환
    impl +=
      this.indent(`const res = await req;
return res.body;`) + '\n}';

    return impl;
  }
}
