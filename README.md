# Swagger 2 TS (Swagger to TypeScript)

**Swagger 2 TS** is a Chrome extension that reads API documentation based on Swagger 2.0 and OpenAPI 3.x and converts it into TypeScript code. It helps developers quickly convert API documentation into TypeScript interfaces and API functions.

By automating the process of converting API documentation to TypeScript code, it greatly improves development productivity. You can select API endpoints directly from Swagger UI or OpenAPI pages and instantly generate TypeScript code in your preferred style.

---

## Main Features

- **Swagger 2.0 & OpenAPI 3.x Support**: Automatically detects and converts both specifications
- **Ready to Use**: Use directly in your browser without any separate installation or configuration
- **Real-time Conversion**: Instantly generate and copy code from the Swagger/OpenAPI page you are viewing
- **Selective Conversion**: Convert only the endpoints you need, not the entire API
- **Multiple Styles Supported**: Generate HTTP client code for Fetch, Axios, Ky, SuperAgent, etc.
- **Customization**: Freely set naming conventions for function names, interface names, and property names
- **Template System**: Create and save custom templates
- **Code Formatting**: Include comments, generate JSDoc, and choose export style

---

## How to Use

### 1. Install the Extension

1. Install the **Swagger 2 TS** extension from the Chrome Web Store.
2. After installation, the extension icon will appear in your browser toolbar.

### 2. Use on Swagger/OpenAPI Pages

1. Navigate to a web page with Swagger UI or OpenAPI documentation.
2. Click the extension icon to open the panel.
3. Select the desired API endpoints.

### 3. Generate and Copy Code

1. Select your preferred code style from the top tabs.
2. Set naming conventions and formatting in the code generation options.
3. Review the generated code and click the "Copy" button to copy it.

### 4. Use Custom Templates

1. Select the "Custom" tab.
2. Write your own template or load an existing one.
3. Save templates for reuse.

---

## 🧪 Testing

This project uses [Vitest](https://vitest.dev/) for unit testing.

- Test file naming: `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`
- React Testing Library global setup: `src/setup-test.ts`

### Run Tests

```bash
pnpm test
```

### Coverage Report

```bash
pnpm coverage
```

---

## Contributing

**Swagger 2 TS** is an open-source project, and all contributions are welcome!

### How to Contribute

1. **Issue Reports**: Please report bugs via GitHub Issues.
2. **Feature Suggestions**: Suggest new features via Issues.
3. **Code Contributions**: Contribute code via Pull Requests.

### Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/kimcoder/swagger2ts.git
cd swagger2ts

# Install dependencies
pnpm install

# Start the development server
pnpm run dev

# Build
pnpm run build
```

### Contribution Guidelines

- Follow the project's existing code style conventions.
- Please write test code when adding new features.
- Write clear and descriptive commit messages.

---

## License

This project is distributed under the MIT License. For details, see the [LICENSE](LICENSE) file.

---

**Contact & Feedback**: [GitHub Issues](https://github.com/kimcoder/swagger2ts/issues)
