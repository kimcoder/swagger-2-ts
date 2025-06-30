import { SwaggerPage } from '@/components/layout/swagger-page';
import { createRoot } from 'react-dom/client';
import '../globals.css';
import './index.css';

const root = createRoot(document.getElementById('app')!);
root.render(<SwaggerPage />);
