import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    tiptap: 'src/tiptap.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: [
    '@tiptap/core',
    'prosemirror-state',
    'prosemirror-view',
    'prosemirror-model',
  ],
});
