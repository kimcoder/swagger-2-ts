import { SwaggerDocument } from '@/types/swagger';

// Swagger/OpenAPI 문서 유효성 검사
export function isValidSwaggerDoc(data: any): boolean {
  try {
    // OpenAPI 3.0
    if (data.openapi && data.paths && data.info) {
      return true;
    }
    // Swagger 2.0
    if (data.swagger && data.paths && data.info) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// 스웨거 문서를 찾아 파싱하는 함수
export async function findSwaggerDocument(): Promise<SwaggerDocument | null> {
  try {
    // 1. Swagger UI의 다양한 버전 지원
    const possibleSelectors = [
      '.info > .main > a',
      '.swagger-ui .info a',
      '.opblock-tag-section a[href*="swagger"]',
      '.opblock-tag-section a[href*="api-docs"]',
      'link[rel="swagger"], link[href*="swagger.json"]',
      'link[href*="api-docs.json"]',
    ];

    // 모든 가능한 선택자 시도
    for (const selector of possibleSelectors) {
      const element = document.querySelector(selector);
      if (element instanceof HTMLAnchorElement || element instanceof HTMLLinkElement) {
        const url = element.href;
        // console.log(element.href);
        try {
          const response = await fetch(url);
          const data = await response.json();
          if (isValidSwaggerDoc(data)) {
            // console.log('Found Swagger document via selector:', selector);
            return data;
          }
        } catch (e) {
          // console.log(`Failed to fetch from ${selector}:`, e);
        }
      }
    }

    // 2. 페이지 내 스크립트 태그에서 찾기
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      try {
        if (script.type === 'application/json' || !script.type) {
          const content = JSON.parse(script.textContent || '');
          if (isValidSwaggerDoc(content)) {
            // console.log('Found Swagger document in script tag');
            return content;
          }
        }
      } catch (e) {
        // JSON 파싱 실패는 조용히 넘어감
      }
    }

    // 3. window 객체에서 찾기
    const windowAny = window as any;
    const possibleProps = ['swaggerSpec', '__SWAGGER_SPEC__', '__API_SPEC__', 'spec'];
    for (const prop of possibleProps) {
      if (windowAny[prop] && isValidSwaggerDoc(windowAny[prop])) {
        // console.log('Found Swagger document in window object:', prop);
        return windowAny[prop];
      }
    }

    // console.warn('No valid Swagger document found after trying all methods');
    return null;
  } catch (error) {
    // console.error('Error in findSwaggerDocument:', error);
    return null;
  }
}
