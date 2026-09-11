import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        chess: {
          dark: '#1e293b',
          boardDark: '#739552',
          boardLight: '#ebecd0',
          accent: '#3b82f6',
          panel: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
        },
      },
    },
  },
  plugins: [],
};
export default config;
