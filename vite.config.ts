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
        teacher_menu: resolve(__dirname, 'teacher_menu.html'),
        chemistry_ege: resolve (__dirname, 'chemistry_ege.html'),
        biology_ege: resolve(__dirname, 'biology_ege.html')
      },
      output: {
        // Генерируем предсказуемые имена файлов
        entryFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
})
