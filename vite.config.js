import { resolve } from 'path'
import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import { viteSingleFile } from 'vite-plugin-singlefile'

const projectName = process.env.PROJECT

// Resolve paths depending on PROJECT env
const rootDir = projectName
  ? resolve(__dirname, `projects/${projectName}`)
  : resolve(__dirname, '.')

const inputFile = projectName
  ? resolve(__dirname, `projects/${projectName}/index.html`)
  : resolve(__dirname, 'index.html')

const outDir = projectName
  ? resolve(__dirname, `dist/${projectName}`)
  : resolve(__dirname, 'dist')

export default defineConfig({
  root: rootDir,
  build: {
    rollupOptions: {
      input: inputFile,
    },
    assetsInlineLimit: Infinity,
    outDir,
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: true,
      mangle: true,
    },
  },
  plugins: [
    viteSingleFile(),
    createHtmlPlugin({
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeEmptyAttributes: true,
        minifyJS: true,
        minifyCSS: true,
      },
    }),
  ],
})
