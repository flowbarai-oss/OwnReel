import {defineConfig} from '@playwright/test';
const isolated=process.env.COMMUNITY_E2E==='1';
export default defineConfig({testDir:'./tests/community',timeout:60000,workers:1,use:{baseURL:isolated?'http://localhost:4430':'http://localhost:4420',launchOptions:{channel:'chrome'},viewport:{width:1440,height:900},trace:'retain-on-failure'},outputDir:'test-results',webServer:isolated?[
 {command:'node node_modules/tsx/dist/cli.mjs services/api/src/community/main.ts',url:'http://127.0.0.1:4431/health',timeout:120000,reuseExistingServer:false},
 {command:'node node_modules/next/dist/bin/next dev packages/studio --hostname 127.0.0.1 --port 4430',url:'http://127.0.0.1:4430',timeout:180000,reuseExistingServer:false}
]:undefined});
