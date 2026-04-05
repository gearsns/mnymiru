/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import { playwright } from '@vitest/browser-playwright'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    base: './',
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler']],
        },
      }),
      visualizer({
        open: true, // 2. ビルドが終わったら自動でブラウザで開く
        filename: 'stats.html', // 3. 生成されるファイル名
        gzipSize: true, // 4. gzip圧縮後のサイズも表示
        brotliSize: true,
      }),
    ],
    build: {
      outDir: 'docs',
      sourcemap: mode === 'development',
      commonjsOptions: {
        // handsontable.js を CommonJS/UMD として扱い、default エクスポートを自動生成させる
        transformMixedEsModules: true,
        include: [/handsontable/, /node_modules/],
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            // react 関連を独立させる
            if (id.includes('/myhandsontable') || id.includes('/react') || id.includes('/react-dom')) {
              return 'react-vendor';
            }
            // antd 関連を独立させる
            if (id.includes('/antd') || id.includes('/@ant-design')) {
              return 'antd-vendor';
            }
            // recharts 関連を独立させる
            if (id.includes('/recharts')) {
              return 'recharts-vendor';
            }
          },
        },
      },
    },
    css: {
      devSourcemap: mode === 'development', // CSSも元の場所を特定したいならこれも
    },
    resolve: {
      alias: {
        // 内部の細かいファイルを見に行かないよう、distの完成品に固定する
        'sql.js': path.resolve(__dirname, '../lib/sql.js/sql-wasm.js'),
      }
    },
    optimizeDeps: {
      // 開発サーバー起動時にも同様の変換を適用する
      include: []
    },
    define: {
      // JS内で使用できるグローバル変数を定義
      __BUILD_DATE__: JSON.stringify(new Date().toLocaleString('ja-JP')),
      'import.meta.env.PACKAGE_VERSION': JSON.stringify(pkg.version),
    },
    test: {
      // ブラウザ環境をシミュレート
      environment: 'jsdom',
      // 全てのテストファイルで自動的に `expect` などを使えるようにする
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
            alias: {
              // テスト時だけasm.js版（Nodeで安定する版）に差し替える
              'sql.js': path.resolve(__dirname, 'node_modules/sql.js/dist/sql-asm.js'),
            },
          }
        },
        {
          extends: true,
          test: {
            name: 'browser-integration',
            include: ['src/**/*.browser.test.ts', 'src/**/*.browser.test.tsx'], // ブラウザ用だけ実行
            browser: {
              enabled: true,
              provider: playwright(),
              instances: [{ browser: 'chromium' }],
              headless: true,
            },
          },
          vite: {
            publicDir: 'public',
            server: {
              fs: {
                allow: ['..', './test-fixtures']
              }
            }
          }
        }
      ]
    },
  }
});
