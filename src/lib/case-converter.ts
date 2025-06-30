import { camelCase, pascalCase } from 'es-toolkit';

export type CaseType = 'camelCase' | 'PascalCase';

export class CaseConverter {
  static convert(str: string, caseType: CaseType): string {
    // Clean the string first - remove special characters and normalize
    const cleaned = str.replace(/[^a-zA-Z0-9]/g, ' ').trim();

    let result: string;
    switch (caseType) {
      case 'camelCase':
        result = camelCase(cleaned);
        break;

      case 'PascalCase':
        result = pascalCase(cleaned);
        break;

      default:
        result = str;
    }

    return result;
  }

  static convertCase(str: string, caseType: CaseType): string {
    return this.convert(str, caseType);
  }

  static capitalize(str: string): string {
    return pascalCase(str);
  }

  static getCaseOptions(): { value: CaseType; label: string; example: string }[] {
    return [
      { value: 'camelCase', label: 'camelCase', example: 'getUserById' },
      { value: 'PascalCase', label: 'PascalCase', example: 'GetUserById' },
    ];
  }
}
