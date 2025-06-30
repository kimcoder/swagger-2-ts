import { ApiTable } from '@/components/swagger/api-table';
import { CodeGenerationOptionsModal } from '@/components/swagger/code-generation-options-modal';
import { CodeTemplateModal } from '@/components/swagger/code-template-modal';
import { Button } from '@/components/ui/button';
import { DESCRIPTION, TITLE } from '@/constants/words';
import { useSwagger } from '@/hooks/use-swagger';
import { SwaggerApi } from '@/types/swagger';
import { Settings } from 'lucide-react';
import { useState } from 'react';

export function SwaggerPage() {
  const { isLoading, apiList, error } = useSwagger();
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEndpoints, setSelectedEndpoints] = useState<SwaggerApi[]>([]);

  const handleExport = (data: SwaggerApi[]) => {
    setSelectedEndpoints(data);
    setIsModalOpen(true);
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-white p-4 text-primary">
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <h1 className="ml-2 text-3xl font-bold">{TITLE}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{DESCRIPTION}</p>
      </div>
      <div className="flex w-full justify-end pt-4">
        <Button variant="outline" onClick={() => setIsOptionsModalOpen(true)} className="gap-2">
          <Settings className="h-4 w-4" />
          Code Generation Options
        </Button>
      </div>
      {error ? (
        <h3 className="ml-2 text-3xl font-bold text-red-500">{error.message}</h3>
      ) : (
        <ApiTable isLoading={isLoading} data={apiList} onExport={handleExport} />
      )}
      <CodeTemplateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        endpoints={selectedEndpoints}
      />
      <CodeGenerationOptionsModal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
      />
    </div>
  );
}
