import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'sequence-rainbowkit-plugin': 'src/index.ts'
  },
  format: ['cjs','esm'],
  splitting: true,
  sourcemap: true,
  clean: true,
  dts: {
    resolve: true
  },
})
