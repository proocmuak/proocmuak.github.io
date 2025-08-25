<template>
  <div class="editor-container">
    <!-- ... остальной код без изменений ... -->

    <!-- Поле ответа -->
    <div class="text-editor" id="answer-editor">
      <label>Ответ:</label>
      <div class="editor-toolbar">
        <button @click="insertSubscript('answer')" class="toolbar-button" title="Нижний индекс">
          <span class="button-text">x<span class="subscript">2</span></span>
        </button>
        <button @click="insertSuperscript('answer')" class="toolbar-button" title="Верхний индекс">
          <span class="button-text">x<span class="superscript">2</span></span>
        </button>
        <button @click="triggerFileInput('answer')" class="toolbar-button" title="Добавить изображение">
          📷
        </button>
      </div>
      <!-- ... остальное поле ответа ... -->
    </div>

    <!-- Поле для пояснения -->
    <div class="text-editor">
      <label>Пояснение к ответу:</label>
      <div class="editor-toolbar">
        <button @click="insertSubscript('explanation')" class="toolbar-button" title="Нижний индекс">
          <span class="button-text">x<span class="subscript">2</span></span>
        </button>
        <button @click="insertSuperscript('explanation')" class="toolbar-button" title="Верхний индекс">
          <span class="button-text">x<span class="superscript">2</span></span>
        </button>
        <button @click="triggerFileInput('explanation')" class="toolbar-button" title="Добавить изображение">
          📷
        </button>
      </div>
      <!-- ... остальное поле пояснения ... -->
    </div>

    <!-- Загрузка изображений для основного текста -->
    <div class="image-uploader">
      <label>Изображения для текста задания:</label>
      <div class="upload-controls">
        <input 
          type="file" 
          ref="fileInput" 
          @change="handleFileUpload" 
          multiple 
          accept="image/*" 
          style="display: none"
        >
        <button @click="triggerFileInput('text')" class="upload-button" :disabled="isUploading">
          {{ isUploading ? 'Загрузка...' : 'Выбрать файлы' }}
        </button>
        <span class="file-info">{{ uploadStatus }}</span>
      </div>
      <!-- ... остальная часть загрузки ... -->
    </div>

    <!-- ... остальной код без изменений ... -->
  </div>
</template>

<script>
// ... импорты без изменений ...

export default {
  // ... остальные опции без изменений ...
  methods: {
    // Исправленный метод triggerFileInput
    triggerFileInput(type = 'text') {
      this.currentUploadType = type;
      this.$refs.fileInput.click();
    },

    // Исправленный метод handleFileUpload
    async handleFileUpload(event) {
      const files = event.target.files;
      if (!files.length) return;
      
      this.isUploading = true;
      this.uploadStatus = `Загрузка ${files.length} файла(ов)...`;
      
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          if (file.size > 5 * 1024 * 1024) {
            this.uploadStatus = `Файл ${file.name} слишком большой (макс. 5MB)`;
            continue;
          }
          
          if (!file.type.match('image.*')) {
            this.uploadStatus = `Файл ${file.name} не является изображением`;
            continue;
          }
          
          const preview = await this.getImagePreview(file);
          
          const imageData = {
            file,
            preview,
            name: file.name,
            id: uuidv4()
          };
          
          // Добавляем изображение в соответствующий массив
          if (this.currentUploadType === 'answer') {
            this.answerImages.push(imageData);
          } else if (this.currentUploadType === 'explanation') {
            this.explanationImages.push(imageData);
          } else {
            this.uploadedImages.push(imageData);
          }
        }
        
        this.updateUploadStatus();
      } catch (error) {
        console.error('Ошибка загрузки:', error);
        this.uploadStatus = 'Ошибка при загрузке файлов';
      } finally {
        this.isUploading = false;
        this.$refs.fileInput.value = '';
      }
    },

    // ... остальные методы без изменений ...
  }
};
</script>