import {defineConfig} from 'vitest/config';
export default defineConfig({test: {include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'], exclude: ['tests/live/**'], testTimeout: 10000}});
