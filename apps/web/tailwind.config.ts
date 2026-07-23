import type { Config } from 'tailwindcss';
// Shared shadcn-style preset (colors via CSS variables, radius, container).
import preset from '@erp/config/tailwind-preset';

const config: Config = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    // Scan the shared UI package source so its Tailwind classes are emitted.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
