import type { CodeGenerationOptions } from '@/types/swagger';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CodeOptionsStore {
  options: CodeGenerationOptions;
  updateOptions: (options: Partial<CodeGenerationOptions>) => void;
  resetOptions: () => void;
}

const defaultOptions: CodeGenerationOptions = {
  functionNameCase: 'camelCase',
  interfaceNameCase: 'PascalCase',
  propertyNameCase: 'camelCase',
  includeComments: true,
  includeJSDoc: false,
  exportAsDefault: false,
};

export const useCodeOptions = create<CodeOptionsStore>()(
  persist(
    (set, get) => ({
      options: defaultOptions,

      updateOptions: (newOptions) =>
        set((state) => ({
          options: { ...state.options, ...newOptions },
        })),

      resetOptions: () => set({ options: defaultOptions }),
    }),
    {
      name: 'code-generation-options', // localStorage key
      version: 1,
    },
  ),
);
