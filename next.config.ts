import type { NextConfig } from 'next';
const config:NextConfig={serverExternalPackages:['playwright','playwright-core','@sparticuz/chromium'],outputFileTracingIncludes:{'/api/links/*/check':['./node_modules/@sparticuz/chromium/bin/**/*','./node_modules/playwright-core/browsers.json']}};
export default config;
