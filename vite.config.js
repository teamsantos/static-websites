import { resolve } from 'path'
import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import { viteSingleFile } from 'vite-plugin-singlefile'

const projectName = process.env.PROJECT
const templateName = process.env.TEMPLATE
const editorBuild = process.env.EDITOR_BUILD

// Determine if we should inline all assets (single file mode)
// Only use single file mode for editor builds, not for template/project builds
const useSingleFile = Boolean(editorBuild)

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

// Build plugins array conditionally
const plugins = [
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
];

// Only use viteSingleFile for editor builds
if (useSingleFile) {
    plugins.unshift(viteSingleFile());
}

export default defineConfig({
    root: rootDir,
    // Disable copying public folder to dist since assets are processed through build
    publicDir: false,
    build: {
        rollupOptions: {
            input: inputFile,
            output: {
                // Put images in an 'images' folder within dist
                assetFileNames: (assetInfo) => {
                    const extType = assetInfo.name?.split('.').pop() || '';
                    if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp|avif/i.test(extType)) {
                        return 'images/[name]-[hash][extname]';
                    }
                    return 'assets/[name]-[hash][extname]';
                },
            },
        },
        // Only inline small assets (< 4kb) like small icons
        // Larger images will be output as separate files
        assetsInlineLimit: useSingleFile ? Infinity : 4096,
        outDir,
        emptyOutDir: !editorBuild,
        minify: 'terser',
        terserOptions: {
            compress: true,
            mangle: true,
        },
    },
    plugins,
})
