import { SwaggerDocument } from '@/types/swagger';

/**
 * 주어진 객체가 유효한 Swagger/OpenAPI 스펙인지 검사합니다.
 */
export function isValidSwaggerDoc(data: any): data is SwaggerDocument {
  if (!data || typeof data !== 'object') return false;
  // OpenAPI 3.x
  if (typeof data.openapi === 'string' && data.openapi.startsWith('3') && data.paths && data.info) {
    return true;
  }
  // Swagger 2.0
  if (data.swagger === '2.0' && data.paths && data.info) {
    return true;
  }
  return false;
}

/**
 * Swagger UI 페이지에서 JSON 스펙을 찾아 반환합니다.
 *
 * 1) <link> / <a> 태그
 * 2) <script> inline JSON
 * 3) window 전역변수
 */
export async function findSwaggerDocument(): Promise<SwaggerDocument | null> {
  // 1) link / anchor 태그
  const urlSelectors = [
    'link[rel="swagger"]',
    'link[href$=".json"]',
    'a[href*="swagger.json"]',
    'a[href*="/v2/api-docs"]',
  ];
  for (const sel of urlSelectors) {
    const el = document.querySelector<HTMLLinkElement | HTMLAnchorElement>(sel);
    if (el?.href) {
      try {
        const res = await fetch(el.href);
        const json = await res.json();
        if (isValidSwaggerDoc(json)) {
          return json;
        }
      } catch {
        // 무시하고 다음 선택자 시도
      }
    }
  }

  // 2) <script> inline JSON
  for (const script of Array.from(document.querySelectorAll('script'))) {
    if (!script.type || script.type === 'application/json') {
      try {
        const txt = script.textContent?.trim();
        if (txt) {
          const json = JSON.parse(txt);
          if (isValidSwaggerDoc(json)) {
            return json;
          }
        }
      } catch {
        // invalid JSON 무시
      }
    }
  }

  // 3) window 전역변수
  const w = window as any;
  const props = [
    'swaggerSpec',
    '__SWAGGER_SPEC__',
    '__API_SPEC__',
    'openApiSpec',
    'apiSpec',
    'spec',
  ];
  for (const p of props) {
    if (w[p] && isValidSwaggerDoc(w[p])) {
      return w[p];
    }
  }

  console.warn('⚠️ No valid Swagger/OpenAPI spec found on this page.');
  return null;
}
