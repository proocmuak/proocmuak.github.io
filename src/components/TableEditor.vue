<template>
  <div class="editor-container">
    <button @click="GoBackToEditPage" class="back-button">Вернуться к выбору</button>
    <div class="container">
      <h1>Редактирование таблицы {{ tableTitle }}</h1>
      
      <div class="tabs">
        <button 
          @click="activeTab = 'add'" 
          :class="{ 'active': activeTab === 'add' }"
          class="tab-button"
        >
          Добавить запись
        </button>
        <button 
          @click="activeTab = 'table'" 
          :class="{ 'active': activeTab === 'table' }"
          class="tab-button"
        >
          Просмотр записей
        </button>
      </div>

      <div v-if="activeTab === 'add'" class="add-form">
        <h2>Добавить новую запись</h2>
        <form @submit.prevent="addNewRow">
          <div v-for="field in fields" :key="field.name" class="form-group">
            <label>{{ field.label }}:</label>
            <input 
              v-if="field.type !== 'textarea'" 
              :type="field.type" 
              v-model="newRow[field.name]"
              :disabled="field.disabled"
            >
            <textarea 
              v-else 
              v-model="newRow[field.name]"
            ></textarea>
          </div>
          <button type="submit" class="btn-add">Добавить</button>
        </form>
      </div>

      <div v-if="activeTab === 'table'" class="table-container">
        <h2>Существующие записи</h2>
        <table>
          <thead>
            <tr>
              <th v-for="field in fields" :key="field.name">{{ field.label }}</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row[primaryKey]">
              <td v-for="field in fields" :key="field.name">
                <input 
                  v-if="field.type !== 'textarea'" 
                  :type="field.type" 
                  v-model="row[field.name]"
                  @change="updateRow(row)"
                  :disabled="field.disabled"
                >
                <textarea 
                  v-else 
                  v-model="row[field.name]"
                  @change="updateRow(row)"
                ></textarea>
              </td>
              <td>
                <button @click="deleteRow(row[primaryKey])" class="btn-delete">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase.js'

const props = defineProps({
  tableTitle: {
    type: String,
    required: true
  },
  tableName: {
    type: String,
    required: true
  },
  primaryKey: {
    type: String,
    default: 'id'
  },
  fields: {
    type: Array,
    required: true,
    validator: (fields) => fields.every(f => f.name && f.label && f.type)
  }
})

const emit = defineEmits(['back-to-edit'])
const activeTab = ref('add')
const rows = ref([])
const newRow = ref({})
const nextId = ref(1)

// Инициализация новой строки
const initNewRow = () => {
  newRow.value = props.fields.reduce((obj, field) => {
    obj[field.name] = field.type === 'number' ? 0 : ''
    return obj
  }, {})
}

// Вычисление следующего ID
const calculateNextId = async () => {
  try {
    const { data, error } = await supabase
      .from(props.tableName)
      .select(props.primaryKey)
      .order(props.primaryKey, { ascending: false })
      .limit(1)
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      nextId.value = 1
      return
    }
    
    const maxId = data[0][props.primaryKey]
    
    if (typeof maxId === 'number') {
      nextId.value = maxId + 1
    } else {
      // Для нечисловых ID используем временную метку
      nextId.value = Date.now()
    }
    
    // Обновляем поле в newRow
    if (newRow.value[props.primaryKey] !== undefined) {
      newRow.value[props.primaryKey] = nextId.value
    }
  } catch (error) {
    console.error('Ошибка при вычислении ID:', error)
    nextId.value = Date.now()
  }
}

// Загрузка данных
const fetchRows = async () => {
  try {
    const { data, error } = await supabase
      .from(props.tableName)
      .select('*')
      .order(props.primaryKey, { ascending: true })
    
    if (error) throw error
    rows.value = data || []
  } catch (error) {
    console.error('Ошибка при загрузке данных:', error)
  }
}

// Добавление новой строки
const addNewRow = async () => {
  try {
    const rowToInsert = {
      ...newRow.value,
      [props.primaryKey]: nextId.value
    }
    
    const { error } = await supabase
      .from(props.tableName)
      .insert([rowToInsert])
    
    if (error) throw error
    
    await fetchRows()
    await calculateNextId()
    initNewRow()
    
    alert('Запись успешно добавлена!')
    activeTab.value = 'table'
  } catch (error) {
    console.error('Ошибка при добавлении записи:', error)
    alert('Произошла ошибка при добавлении записи')
  }
}

// Обновление строки
const updateRow = async (row) => {
  try {
    const { error } = await supabase
      .from(props.tableName)
      .update(row)
      .eq(props.primaryKey, row[props.primaryKey])
    
    if (error) throw error
    
    console.log('Запись успешно обновлена')
  } catch (error) {
    console.error('Ошибка при обновлении записи:', error)
  }
}

// Удаление строки
const deleteRow = async (id) => {
  if (!confirm('Вы уверены, что хотите удалить эту запись?')) return
  
  try {
    const { error } = await supabase
      .from(props.tableName)
      .delete()
      .eq(props.primaryKey, id)
    
    if (error) throw error
    
    await fetchRows()
    await calculateNextId()
    
    alert('Запись успешно удалена!')
  } catch (error) {
    console.error('Ошибка при удалении записи:', error)
    alert('Произошла ошибка при удалении записи')
  }
}

// Инициализация компонента
onMounted(async () => {
  initNewRow()
  await fetchRows()
  await calculateNextId()
})

const GoBackToEditPage = () => {
  emit('back-to-edit')
}
</script>

<style scoped>
/* Стили остаются без изменений */
.editor-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
  background: white;
  z-index: 100;
  padding: 20px;
}

.back-button {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 10px 20px;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  z-index: 101;
}

.container {
  position: absolute;
  top: 60px;
  left: 20px;
  right: 20px;
  bottom: 20px;
  overflow-y: auto;
}

.tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
  padding-top: 10px;
}

.tab-button {
  padding: 10px 20px;
  background: #f1f1f1;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s;
}

.tab-button:hover {
  background: #ddd;
}

.tab-button.active {
  background: #4CAF50;
  color: white;
}

.add-form, .table-container {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

h1, h2 {
  color: #333;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

input[type="text"],
input[type="date"],
input[type="number"],
textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

textarea {
  min-height: 80px;
  resize: vertical;
}

button {
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.btn-add {
  background-color: #4CAF50;
  color: white;
}

.btn-delete {
  background-color: #f44336;
  color: white;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

th, td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

th {
  background-color: #f2f2f2;
}

tr:nth-child(even) {
  background-color: #f9f9f9;
}

.table-container {
  overflow-x: auto;
}
</style>