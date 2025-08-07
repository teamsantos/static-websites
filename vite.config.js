import { resolve } from 'path'
import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
    build: {
        rollupOptions: {
            input: resolve(__dirname, 'index.html'),
        },
        assetsInlineLimit: Infinity,
        outDir: 'dist',
        minify: 'terser',
        terserOptions: {
            compress: true,
            mangle: true
        }
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
            }
        })
    ]
})
