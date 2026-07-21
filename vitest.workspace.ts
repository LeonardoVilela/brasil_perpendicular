import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'shared',
      root: './packages/shared',
      environment: 'node',
    },
  },
  {
    test: {
      name: 'detection-core',
      root: './packages/detection-core',
      environment: 'node',
    },
  },
  {
    test: {
      name: 'ui',
      root: './packages/ui',
      environment: 'happy-dom',
      globals: true,
    },
  },
  {
    test: {
      name: 'extension',
      root: './apps/extension',
      environment: 'happy-dom',
      // overlay-manager injeta CSS real (styles.css?inline) no shadow root;
      // sem isso, Vitest troca todo import de CSS por um stub vazio.
      css: true,
    },
  },
]);
