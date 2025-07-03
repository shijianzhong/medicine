import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-json-files',
      writeBundle() {
        // 复制JSON文件到构建目录
        const jsonFiles = [
          '西药部分.json',
          '中成药部分.json', 
          '协议西药.json',
          '协议中成药.json',
          '竞价药品部分.json'
        ];
        
        jsonFiles.forEach(file => {
          const srcPath = resolve(__dirname, 'src', file);
          const destPath = resolve(__dirname, 'dist', 'src', file);
          
          // 确保目标目录存在
          const destDir = resolve(__dirname, 'dist', 'src');
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
          }
          
          // 复制文件
          if (existsSync(srcPath)) {
            copyFileSync(srcPath, destPath);
            console.log(`✅ 已复制: ${file}`);
          } else {
            console.warn(`⚠️  文件不存在: ${srcPath}`);
          }
        });
      }
    }
  ],
  base: './', // 使用相对路径，适配GitHub Pages
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // 保持ico文件的原始名称
          if (assetInfo.name && assetInfo.name.endsWith('.ico')) {
            return 'assets/[name].[ext]'
          }
          return 'assets/[name]-[hash].[ext]'
        }
      }
    }
  }
})
