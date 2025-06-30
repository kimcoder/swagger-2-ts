# Swagger 2 TS (Swagger to TypeScript)

**Swagger 2 TS**는 Swagger 2.0 및 OpenAPI 3.x 기반의 API 문서를 읽어 TypeScript 코드로 변환해주는 크롬 확장 프로그램입니다. 개발자가 API 문서를 빠르게 TypeScript 인터페이스와 API 함수로 변환할 수 있도록 도와줍니다.

API 문서를 TypeScript 코드로 변환하는 과정을 자동화하여 개발 생산성을 크게 향상시킵니다. Swagger UI 또는 OpenAPI 페이지에서 직접 API 엔드포인트를 선택하고, 원하는 스타일의 TypeScript 코드를 즉시 생성할 수 있습니다.

---

## 주요 기능

- **Swagger 2.0 & OpenAPI 3.x 지원**: 두 스펙 모두 자동 인식 및 변환
- **즉시 사용 가능**: 별도의 설치나 설정 없이 브라우저에서 바로 사용
- **실시간 변환**: 현재 보고 있는 Swagger/OpenAPI 페이지에서 바로 코드 생성 및 복사
- **선택적 변환**: 전체 API가 아닌 필요한 엔드포인트만 선택하여 변환
- **다양한 스타일 지원**: Fetch, Axios, Ky, SuperAgent 등 다양한 HTTP 클라이언트 코드 생성
- **커스터마이징**: 함수명, 인터페이스명, 프로퍼티명의 네이밍 컨벤션 자유 설정
- **템플릿 시스템**: 커스텀 템플릿 생성 및 저장 가능
- **코드 포매팅**: 주석 포함, JSDoc 생성, export 방식 선택

---

## 사용법

### 1. 확장 프로그램 설치

1. Chrome Web Store에서 **Swagger 2 TS** 확장 프로그램을 설치합니다.
2. 설치 후 브라우저 툴바에 확장 프로그램 아이콘이 나타납니다.

### 2. Swagger/OpenAPI 페이지에서 사용

1. Swagger UI 또는 OpenAPI 문서가 있는 웹페이지로 이동합니다.
2. 확장 프로그램 아이콘을 클릭하여 패널을 엽니다.
3. 원하는 API 엔드포인트를 선택합니다.

### 3. 코드 생성 및 복사

1. 상단 탭에서 원하는 코드 스타일을 선택합니다.
2. 코드 생성 옵션에서 네이밍 컨벤션과 포매팅을 설정합니다.
3. 생성된 코드를 확인하고 "Copy" 버튼을 클릭하여 복사합니다.

### 4. 커스텀 템플릿 사용

1. "Custom" 탭을 선택합니다.
2. 원하는 템플릿을 작성하거나 기존 템플릿을 불러옵니다.
3. 템플릿을 저장하여 재사용할 수 있습니다.

---

## 🧪 테스트

이 프로젝트는 [Vitest](https://vitest.dev/)를 사용하여 단위 테스트를 수행합니다.

- 테스트 파일 네이밍: `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`
- React Testing Library 글로벌 설정: `src/setup-test.ts`

### 테스트 실행

```bash
pnpm test
```

### 커버리지 리포트

```bash
pnpm coverage
```

---

## 기여하기

**Swagger 2 TS**는 오픈소스 프로젝트이며, 모든 기여를 환영합니다!

### 기여 방법

1. **이슈 리포트**: 버그 발견 시 GitHub Issues에 등록해 주세요.
2. **기능 제안**: 새로운 기능 아이디어가 있으면 Issues에 제안해 주세요.
3. **코드 기여**: Pull Request를 통해 코드 기여를 해주세요.

### 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/kimcoder/swagger2ts.git
cd swagger2ts

# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm run dev

# 빌드
pnpm run build
```

### 기여 가이드라인

- 코드 스타일은 프로젝트의 기존 컨벤션을 따릅니다.
- 새로운 기능 추가 시 테스트 코드도 함께 작성해 주세요.
- 커밋 메시지는 명확하고 설명적으로 작성해 주세요.

---

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

**문의 및 피드백**: [GitHub Issues](https://github.com/kimcoder/swagger2ts/issues)
