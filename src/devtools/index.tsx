import { SwaggerPage } from '@/components/layout/swagger-page';
import { TITLE } from '@/constants/words';
import { createRoot } from 'react-dom/client';
import '../globals.css';
import './index.css';

const root = createRoot(document.getElementById('app')!);
root.render(<SwaggerPage />);

chrome.devtools.panels.create(TITLE, '', '../../devtools.html');
