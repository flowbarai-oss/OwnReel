import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
 {ignores:['**/node_modules/**','**/.next/**','data/**','test-results/**','playwright-report/**','packages/studio/next-env.d.ts']},
 js.configs.recommended,...tseslint.configs.recommended,
 {files:['**/*.{js,mjs,ts,tsx}'],languageOptions:{globals:{process:'readonly',Buffer:'readonly',console:'readonly',setTimeout:'readonly',clearTimeout:'readonly',setInterval:'readonly',clearInterval:'readonly',fetch:'readonly',URL:'readonly',URLSearchParams:'readonly',AbortSignal:'readonly',AbortController:'readonly',Response:'readonly',Request:'readonly',Headers:'readonly',FormData:'readonly',Blob:'readonly',File:'readonly',crypto:'readonly',window:'readonly',document:'readonly',localStorage:'readonly',navigator:'readonly',HTMLMediaElement:'readonly',requestAnimationFrame:'readonly',cancelAnimationFrame:'readonly',structuredClone:'readonly',performance:'readonly',TextEncoder:'readonly',TextDecoder:'readonly',atob:'readonly',btoa:'readonly'}},rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_',caughtErrors:'none'}]}}
);
