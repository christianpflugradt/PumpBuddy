import { defineConfig } from 'vite';
import istanbul from 'vite-plugin-istanbul';

const uiSmokeCoverageEnabled = process.env.UI_SMOKE_COVERAGE === '1';

export default defineConfig({
  build: {
    sourcemap: uiSmokeCoverageEnabled,
  },
  plugins: uiSmokeCoverageEnabled
    ? [
        istanbul({
          include: ['src/**/*'],
          extension: ['.ts'],
          requireEnv: false,
          forceBuildInstrument: true,
        }),
      ]
    : [],
});
