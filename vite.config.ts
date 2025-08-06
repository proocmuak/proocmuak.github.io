import { defineConfig } from 'vite'
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'), // Главная страница
        student_menu: resolve(__dirname, 'student_menu.html'), // Страница "О нас"
        // Добавьте другие страницы
      },
      output: {
        // Генерируем предсказуемые имена файлов
        entryFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
})
