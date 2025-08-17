import { createApp } from 'vue'
import TeacherMenu from "./TeacherMenu.vue"
import { createPinia } from 'pinia'


const pinia = createPinia() // Создаём экземпляр Pinia
const app = createApp(TeacherMenu)

app.use(pinia)
app.mount('#teacher-menu-app')
