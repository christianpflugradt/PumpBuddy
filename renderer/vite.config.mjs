import { defineConfig, loadEnv } from 'vite';
import istanbul from 'vite-plugin-istanbul';

const uiSmokeCoverageEnabled = process.env.UI_SMOKE_COVERAGE === '1';

export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_APP_VERSION');
    process.env.VITE_APP_VERSION ??= env.VITE_APP_VERSION ?? 'dev';
  }
  return {
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
  };
});
