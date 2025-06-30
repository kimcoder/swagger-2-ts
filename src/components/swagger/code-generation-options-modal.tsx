'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useCodeOptions } from '@/hooks/use-code-options';
import { CaseConverter, type CaseType } from '@/lib/case-converter';

interface CodeGenerationOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CodeGenerationOptionsModal({ isOpen, onClose }: CodeGenerationOptionsModalProps) {
  const { options, updateOptions, resetOptions } = useCodeOptions();
  const caseOptions = CaseConverter.getCaseOptions();

  const updateOption = <K extends keyof typeof options>(key: K, value: (typeof options)[K]) => {
    updateOptions({ [key]: value });
  };

  const handleReset = () => {
    resetOptions();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Code Generation Options</DialogTitle>
          <DialogDescription>
            Customize the naming conventions and formatting for generated TypeScript code
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Naming Conventions */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Naming Conventions</h3>
              <Badge variant="secondary" className="text-xs">
                Applied to all generated code
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Function Names */}
              <div className="space-y-3">
                <Label htmlFor="function-case" className="text-sm font-medium">
                  Function Names
                </Label>
                <Select
                  value={options.functionNameCase}
                  onValueChange={(value: CaseType) => updateOption('functionNameCase', value)}
                >
                  <SelectTrigger id="function-case">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {caseOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {option.example}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  Example:{' '}
                  <code className="rounded bg-muted px-1">
                    {CaseConverter.convertCase('getUserById', options.functionNameCase)}
                  </code>
                </div>
              </div>

              {/* Interface Names */}
              <div className="space-y-3">
                <Label htmlFor="interface-case" className="text-sm font-medium">
                  Interface Names
                </Label>
                <Select
                  value={options.interfaceNameCase}
                  onValueChange={(value: CaseType) => updateOption('interfaceNameCase', value)}
                >
                  <SelectTrigger id="interface-case">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {caseOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {option.example}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  Example:{' '}
                  <code className="rounded bg-muted px-1">
                    {CaseConverter.convertCase('UserRequest', options.interfaceNameCase)}
                  </code>
                </div>
              </div>

              {/* Property Names */}
              <div className="space-y-3">
                <Label htmlFor="property-case" className="text-sm font-medium">
                  Property Names
                </Label>
                <Select
                  value={options.propertyNameCase}
                  onValueChange={(value: CaseType) => updateOption('propertyNameCase', value)}
                >
                  <SelectTrigger id="property-case">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {caseOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {option.example}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  Example:{' '}
                  <code className="rounded bg-muted px-1">
                    {CaseConverter.convertCase('firstName', options.propertyNameCase)}
                  </code>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Code Formatting Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Code Formatting</h3>

            <div className="grid grid-cols-2 gap-6">
              {[
                {
                  id: 'include-comments',
                  label: 'Include Comments',
                  description: 'Add inline comments with HTTP method and path',
                  checked: options.includeComments,
                  onChange: (checked: boolean) => updateOption('includeComments', checked),
                },
                {
                  id: 'include-jsdoc',
                  label: 'Include JSDoc',
                  description: 'Generate JSDoc comments with descriptions and tags',
                  checked: options.includeJSDoc,
                  onChange: (checked: boolean) => updateOption('includeJSDoc', checked),
                },
                {
                  id: 'export-default',
                  label: 'Export as Default',
                  description: 'Use default exports instead of named exports',
                  checked: options.exportAsDefault,
                  onChange: (checked: boolean) => updateOption('exportAsDefault', checked),
                },
              ].map((option) => (
                <div key={option.id} className="flex items-center justify-between space-x-4">
                  <div className="flex-1 space-y-0.5">
                    <Label htmlFor={option.id} className="text-sm font-medium">
                      {option.label}
                    </Label>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      id={option.id}
                      checked={option.checked}
                      onCheckedChange={option.onChange}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Preview */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Preview</h3>
            <div className="w-[650px] max-w-full overflow-x-auto rounded-md bg-muted p-4">
              <pre className="whitespace-pre text-sm">
                <code>{`${options.includeJSDoc ? '/**\n * Get user by ID\n * @tags user\n */\n' : ''}${options.exportAsDefault ? 'export default' : 'export'} interface ${CaseConverter.convertCase('GetUserByIdRequest', options.interfaceNameCase)} {
  ${CaseConverter.convertCase('userId', options.propertyNameCase)}: number;
}

export const ${CaseConverter.convertCase('getUserById', options.functionNameCase)} = async (params: ${CaseConverter.convertCase('GetUserByIdRequest', options.interfaceNameCase)}) => {${options.includeComments ? ' // GET /user/{userId}' : ''}
  // Implementation here
};`}</code>
              </pre>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onClose}>Apply Settings</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
