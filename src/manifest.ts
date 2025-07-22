import { defineManifest } from '@crxjs/vite-plugin';
import packageData from '../package.json';

const isDev = process.env.NODE_ENV == 'development';

export default defineManifest({
  name: `${packageData.displayName || packageData.name}${isDev ? ` ➡️ Dev` : ''}`,
  description: packageData.description,
  version: packageData.version,
  manifest_version: 3,
  icons: {
    16: 'img/logo_16x16.png',
    32: 'img/logo_32x32.png',
    48: 'img/logo_48x48.png',
    128: 'img/logo_128x128.png',
  },
  action: {
    default_popup: 'popup.html',
    default_icon: 'img/logo_48x48.png',
  },
  devtools_page: 'devtools.html',
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      js: ['src/contentScript/index.ts'],
    },
  ],
  web_accessible_resources: [
    {
      resources: [
        'img/logo_16x16.png',
        'img/logo_32x32.png',
        'img/logo_48x48.png',
        'img/logo_128x128.png',
      ],
      matches: [],
    },
  ],
  permissions: ['activeTab'],
  optional_permissions: ['clipboardWrite'],
  host_permissions: ['<all_urls>'],
});
