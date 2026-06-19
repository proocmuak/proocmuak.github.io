<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase.js'

// === Конфигурация прокси сервера ===
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

const PROXY_CONFIG = {
  enabled: true,
  baseUrl: isLocalhost 
    ? 'https://schoolpurto.ru/storage' 
    : '/storage'
}

const emit = defineEmits(['component-change'])

const userEmail = ref('')
const firstName = ref('Добавьте имя')
const lastName = ref('в настройках')
const avatarUrl = ref(null)
const loading = ref(true)
const error = ref(null)
const activeMenu = ref('main_teacher_page')
let subscription = null

const switchComponent = (componentName) => {
  activeMenu.value = componentName
  emit('component-change', componentName)
}

// === Функция для получения прокси-URL аватарки ===
const getAvatarProxyUrl = (ref) => {
  if (!ref) return null
  
  if (!ref.startsWith('http')) {
    if (PROXY_CONFIG.enabled) {
      return `${PROXY_CONFIG.baseUrl}/avatar/${ref}`
    }
    return ref
  }
  
  if (ref.includes('supabase.co')) {
    const match = ref.match(/\/storage\/v1\/object\/public\/avatar\/(.+)$/)
    if (match) {
      return `${PROXY_CONFIG.baseUrl}/avatar/${match[1]}`
    }
  }
  
  return ref
}

const fetchUserData = async () => {
  try {
    if (!userEmail.value) return
    
    const { data, error: supabaseError } = await supabase
      .from('personalities')
      .select('first_name, last_name, avatar_id')
      .eq('email', userEmail.value)
      .single()

    if (supabaseError) throw supabaseError
    
    firstName.value = data?.first_name || 'Добавьте имя'
    lastName.value = data?.last_name || 'в настройках'
    
    if (data?.avatar_id) {
      const { data: avatarData, error: avatarError } = await supabase
        .from('avatar')
        .select('id, name, ref')
        .eq('id', data.avatar_id)
        .single()
      
      if (!avatarError && avatarData) {
        avatarUrl.value = getAvatarProxyUrl(avatarData.ref)
      }
    }
    
  } catch (err) {
    console.error('Ошибка:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const setupRealtime = () => {
  subscription = supabase
    .channel('personal_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'personalities',
        filter: `email=eq.${userEmail.value}`
      },
      () => {
        fetchUserData()
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'avatar'
      },
      () => {
        fetchUserData()
      }
    )
    .subscribe()
}

onMounted(async () => {
  try {
    userEmail.value = localStorage.getItem('userEmail') || ''
    if (!userEmail.value) throw new Error('Email не найден в localStorage')
    
    await fetchUserData()
    setupRealtime()
    
  } catch (err) {
    console.error('Ошибка инициализации:', err)
    error.value = err.message
  }
})

onUnmounted(() => {
  if (subscription) {
    supabase.removeChannel(subscription)
  }
})
</script>

<template>
  <div class="leftpartpage">
    <div class="leftmenu">
      <div class="about_student_big" @click="switchComponent('main_teacher_page')">
        <div class="avatar">
          <img v-if="avatarUrl" :src="avatarUrl" class="photo_avatar">
          <div v-else class="default-avatar">Выберите аватарку</div>
        </div>
        <div class="about_student">
          <div class="user-info" :class="{ 'settings-message': firstName === 'Добавьте имя' && lastName === 'в настройках' }">
            {{ firstName }} {{ lastName }}
          </div>
          <div class="number_of_points">5465 баллов</div>
        </div>
      </div>

      <div class="line"></div>
      
      <div class="menu">
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'main_teacher_page' }"
          @click="switchComponent('main_teacher_page')"
        >
          Редактор курса
        </button>
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'editor_bank_task' }"
          @click="switchComponent('editor_bank_task')"
        >
          Редактор банка заданий
        </button>
        <a href="/task_bank.html" class="menu_button black_text_a">Банк заданий</a>
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'editor_students' }"
          @click="switchComponent('editor_students')"
        >
          Редактор учеников
        </button>
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'editor_homework' }"
          @click="switchComponent('editor_homework')"
        >
          Редактор домашек
        </button>
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'all_students' }"
          @click="switchComponent('all_students')"
        >
          Все ученики
        </button>
        <a href="/TutorTaskBank.html" class="menu_button black_text_a">Редактор существующих заданий</a>
        <div class="menu_button">Уведомления</div>
        <!-- НОВАЯ КНОПКА -->
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'upload_useful_materials' }"
          @click="switchComponent('upload_useful_materials')"
        >
          Загрузить материалы
        </button>
        <button 
          class="menu_button" 
          :class="{ active: activeMenu === 'settings' }"
          @click="switchComponent('settings')"
        >
          Настройки
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  font-family: Evolventa, sans-serif;
  box-sizing: border-box;
}

.leftpartpage {
  display: grid;
  place-content: center;
  height: 80vh;
  position: sticky;
  top: 0;
  padding: 10px;
}

.leftmenu {
  display: grid;
  grid-template-rows: auto 1px auto;
  gap: 20px;
  background-color: #f9f8ff;
  border-radius: 20px;
  padding: 28px 0;
  width: 100%;
  min-width: 340px;
  max-width: 420px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.about_student_big {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 28px;
  cursor: pointer;
}

.photo_avatar {
  height: 64px;
  width: 64px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.default-avatar {
  height: 64px;
  width: 64px;
  border-radius: 50%;
  background-color: #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  text-align: center;
  color: #888;
  padding: 6px;
  flex-shrink: 0;
}

.about_student {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-info {
  font-weight: bold;
  font-size: 17px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-info.settings-message {
  color: #b241d1;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.number_of_points {
  font-size: 14px;
  color: #666;
}

.line {
  background-color: #b241d1;
  width: 100%;
  height: 1.5px;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 20px;
}

.menu_button {
  background: none;
  border: none;
  font-family: Evolventa;
  font-size: 16px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  padding: 10px 16px;
  color: #333;
  transition: all 0.2s ease;
  border-radius: 10px;
  white-space: nowrap;
}

.menu_button.active {
  color: #b241d1;
  font-weight: bold;
  background-color: rgba(178, 65, 209, 0.1);
}

.menu_button:hover:not(.active) {
  background-color: rgba(178, 65, 209, 0.06);
  color: #b241d1;
}

.black_text_a {
  color: #333;
  text-decoration: none;
  display: block;
  width: 100%;
}

.black_text_a:hover {
  color: #b241d1;
}

/* Адаптивность */
@media (max-width: 1024px) {
  .leftmenu {
    min-width: 300px;
    max-width: 360px;
    padding: 24px 0;
    gap: 16px;
  }
  
  .photo_avatar, .default-avatar {
    height: 56px;
    width: 56px;
  }
  
  .user-info {
    font-size: 15px;
  }
  
  .menu_button {
    font-size: 14px;
    padding: 8px 14px;
  }
  
  .about_student_big {
    padding: 0 24px;
  }
  
  .menu {
    padding: 0 16px;
  }
}

@media (max-width: 768px) {
  .leftpartpage {
    height: auto;
    position: relative;
    padding: 8px;
  }
  
  .leftmenu {
    min-width: unset;
    max-width: 100%;
    padding: 20px 0;
    gap: 14px;
    border-radius: 16px;
  }
  
  .about_student_big {
    padding: 0 16px;
    gap: 12px;
  }
  
  .photo_avatar, .default-avatar {
    height: 48px;
    width: 48px;
  }
  
  .user-info {
    font-size: 14px;
  }
  
  .number_of_points {
    font-size: 12px;
  }
  
  .menu {
    padding: 0 12px;
    gap: 2px;
  }
  
  .menu_button {
    font-size: 13px;
    padding: 8px 12px;
    border-radius: 8px;
    white-space: normal;
    word-break: break-word;
  }
}

@media (max-width: 480px) {
  .leftmenu {
    padding: 16px 0;
    gap: 12px;
    border-radius: 12px;
  }
  
  .about_student_big {
    padding: 0 14px;
    gap: 10px;
  }
  
  .photo_avatar, .default-avatar {
    height: 44px;
    width: 44px;
  }
  
  .user-info {
    font-size: 13px;
  }
  
  .number_of_points {
    font-size: 11px;
  }
  
  .menu {
    padding: 0 10px;
    gap: 2px;
  }
  
  .menu_button {
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 6px;
    white-space: normal;
    word-break: break-word;
  }
}

/* Альбомная ориентация */
@media (max-width: 768px) and (orientation: landscape) {
  .leftpartpage {
    height: auto;
  }
  
  .leftmenu {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 12px 20px;
    gap: 10px;
    max-width: 100%;
    border-radius: 14px;
  }
  
  .about_student_big {
    width: auto;
    padding: 0;
  }
  
  .line {
    display: none;
  }
  
  .menu {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1;
    padding: 0;
  }
  
  .menu_button {
    width: auto;
    padding: 6px 14px;
    font-size: 13px;
    border-radius: 8px;
    white-space: nowrap;
  }
}
</style>