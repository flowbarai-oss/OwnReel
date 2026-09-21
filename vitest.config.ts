import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
export default defineConfig({resolve:{alias:{'@':resolve('packages/studio')}},test:{include:['services/**/*.test.ts','packages/**/*.test.ts','tests/**/*.test.ts'],testTimeout:30000}});
