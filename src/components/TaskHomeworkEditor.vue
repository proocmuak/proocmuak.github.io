<template>
  <div class="task-homework-editor">
    <div class="editor-header">
      <h2>Редактор заданий для домашней работы {{ homeworkName }}</h2>
      <div class="header-actions">
        <button 
          @click="openHomeworkSimple"
          class="view-homework-btn"
          title="Посмотреть домашнюю работу в новой вкладке"
        >
          Посмотреть домашку
        </button>
        <button @click="$emit('close')" class="close-button">Закрыть</button>
      </div>
    </div>

    <div class="mode-selector">
      <button
        @click="setMode('existing')"
        :class="{ active: mode === 'existing' }"
      >
        Выбрать существующие задания
      </button>
      <button
        @click="setMode('new')"
        :class="{ active: mode === 'new' }"
      >
        Создать новое задание
      </button>
    </div>

    <div class="editor-content">
      <TeacherTaskBank
        v-if="mode === 'existing'"
        :homework-id="homeworkId"
        :homework-name="homeworkName"
        :subject="subject"
        :exam-type="examType"
      />
      <EditorHomeworkTask
        v-if="mode === 'new'"
        :homework-id="homeworkId"
        :homework-name="homeworkName"
        :subject="subject"
        :exam-type="examType"
      />
    </div>
  </div>
</template>

<script>
import TeacherTaskBank from '../TeacherTaskBank.vue'
import EditorHomeworkTask from './editor_homework_task.vue'

export default {
  name: 'TaskHomeworkEditor',
  components: {
    TeacherTaskBank,
    EditorHomeworkTask
  },
  props: {
    homeworkId: {
      type: Number,
      required: true
    },
    homeworkName: {
      type: String,
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    examType: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      mode: 'existing'
    }
  },
  methods: {
    setMode(mode) {
      this.mode = mode
    },
    openHomeworkSimple() {
      try {
        const params = new URLSearchParams({
          subject: `${this.subject}_${this.examType}`,
          homework_id: this.homeworkId,
          homework_name: this.homeworkName,
          view_mode: 'student'
        })
        
        window.location.href = `homework.html?${params.toString()}`
        
      } catch (error) {
        console.error('Ошибка открытия домашнего задания:', error)
        alert('Не удалось открыть домашнее задание.')
      }
    }
  }
}
</script>

<style scoped>
*{
    font-family: Evolventa;
}
.task-homework-editor {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  z-index: 1000;
  padding: 20px;
  overflow-y: auto;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.view-homework-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.view-homework-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
}

.close-button {
  padding: 8px 16px;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.mode-selector {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.mode-selector button {
  padding: 10px 20px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.mode-selector button.active {
  background: #b241d1;
  color: white;
  border-color: #9a36b8;
}

.editor-content {
  margin-top: 20px;
}

/* Адаптивность для мобильных устройств */
@media (max-width: 768px) {
  .editor-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .view-homework-btn,
  .close-button {
    flex: 1;
    text-align: center;
  }
}
</style>  