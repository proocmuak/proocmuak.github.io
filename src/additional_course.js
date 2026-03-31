import { createApp } from 'vue'
import { supabase } from './supabase.js'
import AdditionalCourse from "./AdditionalCourse.vue"


window.supabase = supabase

const app = createApp(AdditionalCourse)
app.mount('#additional-course-app')
