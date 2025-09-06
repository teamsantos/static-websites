import { resolve } from 'path'
import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import { viteSingleFile } from 'vite-plugin-singlefile'

const projectName = process.env.PROJECT
const templateName = process.env.TEMPLATE
const editorBuild = process.env.EDITOR_BUILD

// Resolve paths depending on PROJECT env
function parseEnv() {
    if (projectName) {
        return {
            rootDir: resolve(__dirname, `projects/${projectName}`),
            inputFile: resolve(__dirname, `projects/${projectName}/index.html`),
            outDir: resolve(__dirname, `dist/${projectName}`)
        };
    }
    if (templateName) {
        return {
            rootDir: resolve(__dirname, `templates/${templateName}`),
            inputFile: resolve(__dirname, `templates/${templateName}/index.html`),
            outDir: resolve(__dirname, `templates/${templateName}/dist`)
        };
    }
    if (editorBuild) {
        return {
            rootDir: resolve(__dirname, '.'),
            inputFile: resolve(__dirname, 'template-editor.html'),
            outDir: resolve(__dirname, 'dist')
        };
    }
    return {
        rootDir: resolve(__dirname, '.'),
        inputFile: resolve(__dirname, 'index.html'),
        outDir: resolve(__dirname, 'dist')
    };
}

const { rootDir, inputFile, outDir } = parseEnv();

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
