<template>
  <div class="generator-container">
    <div class="header">
      <h2>Генератор вариантов</h2>
    </div>

    <div class="generator-controls">
      <div class="subject-selector">
        <CustomDropdown
          v-model="selectedSubject"
          :options="subjectOptions"
          placeholder="Выберите предмет"
          class="subject-dropdown"
        />
      </div>
      <button 
        @click="generateVariant" 
        class="generate-btn"
        :disabled="!selectedSubject || isLoading"
      >
        {{ isLoading ? 'Генерация...' : 'Сгенерировать вариант' }}
      </button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Загрузка...</p>
    </div>

    <div v-else-if="variants.length === 0" class="empty-state">
      <p>У вас пока нет созданных вариантов</p>
    </div>

    <div v-else class="variants-list">
      <div 
        v-for="variant in variants" 
        :key="variant.id"
        class="variant-card"
      >
        <div class="variant-info">
          <span class="variant-number">Вариант #{{ variant.id_for_user }}</span>
          <span class="variant-date">{{ formatDate(variant.created_at) }}</span>
          <span class="variant-tasks-count">{{ variant.tasks.length }} заданий</span>
        </div>
        <div class="variant-actions">
          <button @click="openVariant(variant)" class="open-btn">
            Открыть
          </button>
          <button @click="deleteVariant(variant.id)" class="delete-btn">
            Удалить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../supabase'
import CustomDropdown from './CustomDropdown.vue'

export default {
  name: 'GeneratorVariants',
  components: {
    CustomDropdown
  },
  setup() {
    const selectedSubject = ref(null)
    const subjectOptions = ref([])
    const variants = ref([])
    const isLoading = ref(false)
    const error = ref(null)
    const userId = ref(null)

    // Конфигурация предметов
    const subjectConfig = {
      'Химия ЕГЭ': { table: 'chemistry_ege', maxTasks: 34 },
      'Химия ОГЭ': { table: 'chemistry_oge', maxTasks: 23 },
      'Биология ЕГЭ': { table: 'biology_ege', maxTasks: 28 },
      'Биология ОГЭ': { table: 'biology_oge', maxTasks: 26 }
    }

    const getSubjectKey = (subjectName) => {
      const map = {
        'Химия ЕГЭ': 'chemistry_ege',
        'Химия ОГЭ': 'chemistry_oge',
        'Биология ЕГЭ': 'biology_ege',
        'Биология ОГЭ': 'biology_oge'
      }
      return map[subjectName] || subjectName
    }

    const getVariantTableName = (subjectName) => {
      const key = getSubjectKey(subjectName)
      return `${key}_created_variants`
    }

    const getCurrentUserId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        return user?.id || null
      } catch (err) {
        console.error('Ошибка получения ID пользователя:', err)
        return null
      }
    }

    const fetchUserSubjects = async () => {
      try {
        userId.value = await getCurrentUserId()
        if (!userId.value) {
          error.value = 'Пользователь не авторизован'
          return
        }

        const { data, error: studentError } = await supabase
          .from('students')
          .select('subject1, subject2')
          .eq('user_id', userId.value)
          .single()

        if (studentError) throw studentError

        const options = []
        if (data?.subject1) {
          options.push({
            value: data.subject1,
            label: data.subject1
          })
        }
        if (data?.subject2) {
          options.push({
            value: data.subject2,
            label: data.subject2
          })
        }

        subjectOptions.value = options

        if (options.length > 0) {
          selectedSubject.value = options[0].value
        }

      } catch (err) {
        console.error('Ошибка загрузки предметов:', err)
        error.value = 'Не удалось загрузить список предметов'
      }
    }

    const fetchVariants = async () => {
      if (!selectedSubject.value || !userId.value) return

      isLoading.value = true
      error.value = null

      try {
        const tableName = getVariantTableName(selectedSubject.value)
        
        const { data, error: variantsError } = await supabase
          .from(tableName)
          .select('*')
          .eq('user_id', userId.value)
          .order('created_at', { ascending: false })

        if (variantsError) throw variantsError

        variants.value = data || []

      } catch (err) {
        console.error('Ошибка загрузки вариантов:', err)
        error.value = 'Не удалось загрузить созданные варианты'
      } finally {
        isLoading.value = false
      }
    }

const generateVariant = async () => {
  if (!selectedSubject.value || !userId.value) return

  isLoading.value = true
  error.value = null

  try {
    const subjectName = selectedSubject.value
    const config = subjectConfig[subjectName]
    if (!config) {
      throw new Error('Неизвестный предмет')
    }

    const tableName = getVariantTableName(subjectName)
    const taskTable = `${config.table}_task_bank`

    console.log('Генерация варианта для:', subjectName)
    console.log('Таблица заданий:', taskTable)

    // Получаем максимальный id_for_user для этого пользователя
    const { data: maxIdData, error: maxIdError } = await supabase
      .from(tableName)
      .select('id_for_user')
      .eq('user_id', userId.value)
      .order('id_for_user', { ascending: false })
      .limit(1)

    if (maxIdError && maxIdError.code !== 'PGRST116') {
      throw maxIdError
    }

    const nextIdForUser = (maxIdData && maxIdData.length > 0) 
      ? maxIdData[0].id_for_user + 1 
      : 1

    console.log('Номер варианта для пользователя:', nextIdForUser)

    // Получаем ВСЕ задания с пагинацией
    let allTasks = []
    let from = 0
    const batchSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: tasksBatch, error: tasksError } = await supabase
        .from(taskTable)
        .select('id, number')
        .order('number', { ascending: true })
        .range(from, from + batchSize - 1)

      if (tasksError) {
        console.error('Ошибка получения заданий:', tasksError)
        throw tasksError
      }

      if (tasksBatch && tasksBatch.length > 0) {
        allTasks = [...allTasks, ...tasksBatch]
        from += batchSize
      }

      if (!tasksBatch || tasksBatch.length < batchSize) {
        hasMore = false
      }
    }

    console.log('Всего заданий в банке (получено):', allTasks.length)

    if (allTasks.length === 0) {
      error.value = 'В банке заданий нет заданий для генерации варианта'
      return
    }

    // Группируем задания по номеру
    const tasksByNumber = {}
    allTasks.forEach(task => {
      const num = Number(task.number)
      if (!tasksByNumber[num]) {
        tasksByNumber[num] = []
      }
      tasksByNumber[num].push(task)
    })

    const availableNumbers = Object.keys(tasksByNumber).map(Number).sort((a, b) => a - b)
    console.log('Уникальные номера:', availableNumbers)
    console.log('Количество уникальных номеров:', availableNumbers.length)

    if (availableNumbers.length === 0) {
      error.value = 'В банке заданий нет заданий для генерации варианта'
      return
    }

    // Выбираем по 1 заданию с каждого номера
    const selectedTasks = []
    for (const num of availableNumbers) {
      const tasksForNumber = tasksByNumber[num] || []
      if (tasksForNumber.length > 0) {
        const randomIndex = Math.floor(Math.random() * tasksForNumber.length)
        const selectedId = tasksForNumber[randomIndex].id
        selectedTasks.push(selectedId)
        console.log(`Номер ${num}: выбрано задание ID ${selectedId} (всего ${tasksForNumber.length} вариантов)`)
      }
    }

    console.log('Итого выбрано заданий:', selectedTasks.length)

    if (selectedTasks.length === 0) {
      error.value = 'Не найдено заданий для генерации варианта'
      return
    }

    // Сохраняем вариант
    const { data: newVariant, error: insertError } = await supabase
      .from(tableName)
      .insert({
        user_id: userId.value,
        id_for_user: nextIdForUser,
        tasks: selectedTasks,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Ошибка сохранения варианта:', insertError)
      throw insertError
    }

    console.log('Вариант успешно создан:', newVariant)

    // Добавляем в список
    variants.value.unshift(newVariant)

  } catch (err) {
    console.error('Ошибка генерации варианта:', err)
    error.value = 'Не удалось сгенерировать вариант: ' + err.message
  } finally {
    isLoading.value = false
  }
}
    const deleteVariant = async (variantId) => {
      if (!confirm('Вы уверены, что хотите удалить этот вариант?')) return

      isLoading.value = true

      try {
        const tableName = getVariantTableName(selectedSubject.value)
        
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .eq('id', variantId)

        if (deleteError) throw deleteError

        variants.value = variants.value.filter(v => v.id !== variantId)

      } catch (err) {
        console.error('Ошибка удаления варианта:', err)
        error.value = 'Не удалось удалить вариант'
      } finally {
        isLoading.value = false
      }
    }

    const openVariant = (variant) => {
      try {
        const subjectName = selectedSubject.value
        const subjectKey = getSubjectKey(subjectName)
        
        const params = new URLSearchParams({
          variant_id: variant.id,
          subject: subjectKey,
          variant_number: variant.id_for_user,
          view_mode: 'student'
        }).toString()
        
        window.location.href = `/variant.html?${params}`
      } catch (error) {
        console.error('Ошибка открытия варианта:', error)
        alert('Не удалось открыть вариант.')
      }
    }

    const formatDate = (dateString) => {
      if (!dateString) return ''
      return new Date(dateString).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    watch(selectedSubject, (newSubject) => {
      if (newSubject) {
        fetchVariants()
      }
    })

    onMounted(async () => {
      await fetchUserSubjects()
    })

    return {
      selectedSubject,
      subjectOptions,
      variants,
      isLoading,
      error,
      generateVariant,
      deleteVariant,
      openVariant,
      formatDate
    }
  }
}
</script>

<style scoped>
.generator-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header h2 {
  color: #333;
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
}

.generator-controls {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.subject-selector {
  flex: 1;
  min-width: 220px;
  max-width: 350px;
}

.subject-dropdown {
  width: 100%;
}

.generate-btn {
  padding: 10px 28px;
  background: #b241d1;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  height: 42px;
  white-space: nowrap;
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(178, 65, 209, 0.3);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.error-message {
  background: #fef2f2;
  color: #dc2626;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #fecaca;
  margin-bottom: 16px;
}

.loading-state {
  text-align: center;
  padding: 40px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f0e6f7;
  border-top: 4px solid #b241d1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-state p {
  color: #b241d1;
  font-size: 16px;
}

.empty-state {
  text-align: center;
  padding: 48px 20px;
  background: #f9f8ff;
  border-radius: 12px;
  border: 2px dashed #e8d4f2;
  color: #666;
  font-size: 16px;
}

.variants-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.variant-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border-radius: 10px;
  border: 1px solid #f0e6f7;
  box-shadow: 0 2px 8px rgba(178, 65, 209, 0.06);
  transition: all 0.3s ease;
  flex-wrap: wrap;
  gap: 12px;
}

.variant-card:hover {
  border-color: #b241d1;
  box-shadow: 0 4px 16px rgba(178, 65, 209, 0.1);
}

.variant-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.variant-number {
  font-weight: 600;
  color: #333;
  font-size: 16px;
}

.variant-date {
  color: #888;
  font-size: 14px;
}

.variant-tasks-count {
  background: #f0e6f7;
  color: #5a2d7a;
  padding: 2px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.variant-actions {
  display: flex;
  gap: 10px;
}

.open-btn,
.delete-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  cursor: pointer;
  transition: all 0.2s ease;
}

.open-btn {
  background: #b241d1;
  color: white;
}

.open-btn:hover {
  background: #9a36b8;
  transform: translateY(-1px);
}

.delete-btn {
  background: #f3f4f6;
  color: #666;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #dc2626;
  transform: translateY(-1px);
}

/* Адаптивность */
@media (max-width: 768px) {
  .generator-container {
    padding: 16px;
  }

  .generator-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .subject-selector {
    max-width: 100%;
    min-width: unset;
  }

  .generate-btn {
    width: 100%;
  }

  .variant-card {
    flex-direction: column;
    align-items: stretch;
    padding: 14px 16px;
  }

  .variant-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .variant-actions {
    justify-content: flex-end;
    margin-top: 4px;
  }
}

@media (max-width: 480px) {
  .generator-container {
    padding: 12px;
  }

  .header h2 {
    font-size: 20px;
  }

  .variant-card {
    padding: 12px 14px;
  }

  .variant-number {
    font-size: 14px;
  }

  .variant-date {
    font-size: 12px;
  }

  .variant-tasks-count {
    font-size: 12px;
    padding: 1px 10px;
  }

  .open-btn,
  .delete-btn {
    padding: 5px 12px;
    font-size: 12px;
  }
}
</style>