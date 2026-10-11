/// <reference types="vitest" />
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { visualizer } from 'rollup-plugin-visualizer';
import pkg from './package.json' with { type: 'json' }
import path from "path"

export default defineConfig(({ }) => {
    return {
        base: "./",
        plugins: [
            solid(),
            visualizer({
                open: false, // 2. ビルドが終わったら自動でブラウザで開くかどうか
                filename: 'stats.html', // 3. 生成されるファイル名
                gzipSize: true, // 4. gzip圧縮後のサイズも表示
                brotliSize: true,
            }),],
        define: {
            // JS内で使用できるグローバル変数を定義
            __BUILD_DATE__: JSON.stringify(new Date().toLocaleString('ja-JP')),
            'import.meta.env.PACKAGE_VERSION': JSON.stringify(pkg.version),
            'import.meta.env.PACKAGE_DISPLAY_NAME': JSON.stringify(pkg.displayName),
        },
        resolve: {
            alias: {
                "@": path.resolve(import.meta.dirname, "./src"),
            }
        },
        optimizeDeps: {
            // Viteの事前バンドルから除外して、プラグインでトランスパイルさせる
            exclude: ['@arminmajerie/dockview-solid'],
        },
        test: {
            environment: 'jsdom',
            globals: true,
            projects: [
                {
                    extends: true,
                    test: {
                        name: 'node-unit',
                        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], // 通常のテスト
                        exclude: ['src/**/*.browser.test.ts', 'src/**/*.browser.test.tsx'], // ブラウザ用を除外
                        environment: 'jsdom',
                        setupFiles: './src/test/setup.ts',
                    }
                },
            ]
        }
    }
});

