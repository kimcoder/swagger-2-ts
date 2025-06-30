'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Check, Copy, FileText, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useCodeOptions } from '@/hooks/use-code-options';
import type { StrategyType } from '@/lib/strategies/base-strategy';
import { StrategyFactory } from '@/lib/strategies/strategy-factory';
import { DEFAULT_TEMPLATES, generateCustomTemplate } from '@/lib/template-utils';
import type { SavedTemplate, SwaggerApi } from '@/types/swagger';

interface CodeTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpoints: SwaggerApi[];
}

export function CodeTemplateModal({ isOpen, onClose, endpoints }: CodeTemplateModalProps) {
  const [copied, setCopied] = useState(false);
  const [customTemplate, setCustomTemplate] = useState<string>(DEFAULT_TEMPLATES.basic);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateName, setTemplateName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);

  // 코드 생성 옵션 - 전역 상태 사용
  const { options: codeOptions } = useCodeOptions();

  // Load saved templates from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('swagger-custom-templates');
    if (saved) {
      try {
        setSavedTemplates(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved templates:', error);
      }
    }
  }, []);

  // Save templates to localStorage whenever savedTemplates changes
  useEffect(() => {
    if (savedTemplates.length > 0) {
      localStorage.setItem('swagger-custom-templates', JSON.stringify(savedTemplates));
    }
  }, [savedTemplates]);

  // Debug: Log when codeOptions change
  useEffect(() => {
    console.log('Code options changed:', codeOptions);
  }, [codeOptions]);

  const saveTemplate = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    const newTemplate: SavedTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      template: customTemplate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSavedTemplates((prev) => [...prev, newTemplate]);
    setTemplateName('');
    setShowSaveDialog(false);
  };

  const loadTemplate = (templateId: string) => {
    if (
      templateId === 'basic' ||
      templateId === 'reactQuery' ||
      templateId === 'swr' ||
      templateId === 'superagent'
    ) {
      setCustomTemplate(
        DEFAULT_TEMPLATES[templateId as keyof typeof DEFAULT_TEMPLATES] ?? DEFAULT_TEMPLATES.basic,
      );
      setSelectedTemplateId(templateId);
      return;
    }

    const template = savedTemplates.find((t) => t.id === templateId);
    if (template) {
      setCustomTemplate(template.template);
      setSelectedTemplateId(templateId);
    }
  };

  const deleteTemplate = (templateId: string) => {
    setSavedTemplates((prev) => prev.filter((t) => t.id !== templateId));
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId('');
    }
  };

  const updateCurrentTemplate = () => {
    if (
      !selectedTemplateId ||
      selectedTemplateId === 'basic' ||
      selectedTemplateId === 'reactQuery' ||
      selectedTemplateId === 'swr'
    ) {
      return;
    }

    setSavedTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedTemplateId
          ? { ...t, template: customTemplate, updatedAt: new Date().toISOString() }
          : t,
      ),
    );
  };

  const generateCodeWithStrategy = (strategyType: StrategyType): string => {
    const strategy = StrategyFactory.createStrategy(strategyType);
    strategy.setOptions(codeOptions);
    return strategy.generateCode(endpoints, codeOptions);
  };

  const generateInterfacesOnly = () => {
    const strategy = StrategyFactory.createStrategy('fetch'); // Use any strategy for interface generation
    strategy.setOptions(codeOptions);
    return `// Generated TypeScript interfaces for API endpoints
${endpoints
  .map((endpoint) => {
    const requestInterface = strategy.generateRequestInterface(endpoint);
    const responseInterface = strategy.generateResponseInterface(endpoint);

    return `${requestInterface}

${responseInterface}`;
  })
  .join('\n\n')}
`;
  };

  const generateCustomTemplateCode = () => {
    const strategy = StrategyFactory.createStrategy('superagent'); // Use superagent strategy for helper functions
    strategy.setOptions(codeOptions);

    return generateCustomTemplate(
      endpoints,
      customTemplate,
      (endpoint) => strategy.generateRequestInterfaceBody(endpoint),
      (endpoint) => strategy.generateResponseInterfaceBody(endpoint),
      (endpoint) => strategy.generateImplementation(endpoint),
      (method, path, operationId) => strategy.generateFunctionName(method, path, operationId),
      (str) => strategy.capitalize(str),
    );
  };

  const handleCopy = (codeType: StrategyType | 'interfaces' | 'custom') => {
    let code = '';

    switch (codeType) {
      case 'fetch':
      case 'axios':
      case 'ky':
      case 'superagent':
        code = generateCodeWithStrategy(codeType);
        break;
      case 'interfaces':
        code = generateInterfacesOnly();
        break;
      case 'custom':
        code = generateCustomTemplateCode();
        break;
    }

    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[85vh] flex-col sm:max-w-[900px]">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">API to TypeScript</DialogTitle>
              <DialogDescription>
                TypeScript code templates for selected API endpoints ({endpoints.length} selected)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="fetch" className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b pb-4">
            <TabsList className="w-full">
              <TabsTrigger value="fetch" className="flex-1">
                Fetch
              </TabsTrigger>
              <TabsTrigger value="axios" className="flex-1">
                Axios
              </TabsTrigger>
              <TabsTrigger value="ky" className="flex-1">
                Ky
              </TabsTrigger>
              <TabsTrigger value="superagent" className="flex-1">
                SuperAgent
              </TabsTrigger>
              <TabsTrigger value="interfaces" className="flex-1">
                Interfaces
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex-1">
                Custom
              </TabsTrigger>
            </TabsList>
          </div>

          {StrategyFactory.getAvailableStrategies().map((strategyType) => (
            <TabsContent
              key={strategyType}
              value={strategyType}
              className="mt-4 flex-1 overflow-y-auto"
            >
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-2 top-2 z-10 bg-muted"
                  onClick={() => handleCopy(strategyType)}
                >
                  {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>

                <pre className="overflow-x-auto rounded-md bg-muted p-4 pr-20 text-sm">
                  <code>{generateCodeWithStrategy(strategyType)}</code>
                </pre>
              </div>
            </TabsContent>
          ))}

          <TabsContent value="interfaces" className="mt-4 flex-1 overflow-y-auto">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="absolute right-2 top-2 z-10 bg-transparent"
                onClick={() => handleCopy('interfaces')}
              >
                {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>

              <pre className="overflow-x-auto rounded-md bg-muted p-4 pr-20 text-sm">
                <code>{generateInterfacesOnly()}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="mt-4 flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div className="mb-4 flex items-center gap-2">
                <Select value={selectedTemplateId} onValueChange={loadTemplate}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Load template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic Template</SelectItem>
                    <SelectItem value="reactQuery">React Query</SelectItem>
                    <SelectItem value="swr">SWR</SelectItem>
                    <SelectItem value="superagent">SuperAgent</SelectItem>
                    {savedTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {template.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
                  <Save className="mr-1 h-4 w-4" />
                  Save
                </Button>

                {selectedTemplateId &&
                  !['basic', 'reactQuery', 'swr'].includes(selectedTemplateId) && (
                    <>
                      <Button variant="outline" size="sm" onClick={updateCurrentTemplate}>
                        Update
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Template</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this template? This action cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTemplate(selectedTemplateId)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-template">Custom Template</Label>
                <div className="text-sm text-muted-foreground">
                  Available variables:{' '}
                  {`{{functionName}}, {{method}}, {{path}}, {{summary}}, {{description}}, {{operationId}}, {{requestInterface}}, {{responseInterface}}, {{parameters}}, {{tags}}`}
                </div>
                <Textarea
                  id="custom-template"
                  value={customTemplate}
                  onChange={(e) => setCustomTemplate(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="Enter your custom template..."
                />
              </div>

              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-2 top-2 z-10 bg-transparent"
                  onClick={() => handleCopy('custom')}
                >
                  {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>

                <pre className="overflow-x-auto rounded-md bg-muted p-4 pr-20 text-sm">
                  <code>{generateCustomTemplateCode()}</code>
                </pre>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Save Template Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Template</DialogTitle>
              <DialogDescription>
                Give your template a name to save it for future use.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveTemplate}>Save Template</Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
