<script>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { supabase } from './supabase.js'
import DOMPurify from 'dompurify'

// === список заданий с учётом порядка ===
const ORDERED_TASKS = {
  chemistry: [6, 7, 8, 14, 15, 22, 23, 24],
  biology: [2, 6, 8, 10, 12, 14, 16, 19, 20]
};

// === нормализация номера ===
function normalizeTaskNumber(taskNumber) {
  if (taskNumber == null) return null;
  const s = String(taskNumber).trim();
  const m = s.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isNaN(n) ? null : n;
}

// === короткий subject из названия таблицы ===
function shortSubjectFromProgressTable(progressTableName) {
  const s = String(progressTableName).toLowerCase();
  if (s.includes('chemistry')) return 'chemistry';
  if (s.includes('biology')) return 'biology';
  return null;
}

// === вспомогательные функции ===
function splitAnswerVariantsRaw(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[/]|ИЛИ/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function isDigitSequence(s) {
  return /^[0-9]+$/.test(s);
}

function splitNumericElements(s) {
  return s.split('').filter(ch => /\d/.test(ch));
}

function normalizeText(s) {
  return s.toLowerCase().replace(/\s+/g, '');
}

// === проверка числовых ответов ===
function checkNumericAnswer(userRaw, variant, points, orderMatters) {
  const userElems = splitNumericElements(userRaw);
  const correctElems = splitNumericElements(variant);

  if (orderMatters) {
    // порядок обязателен
    let matches = 0;
    for (let i = 0; i < correctElems.length; i++) {
      if (userElems[i] === correctElems[i]) matches++;
    }
    const mistakes = correctElems.length - matches;
    if (mistakes === 0) {
      return { correct: true, partial: false };
    }
    if (points === 2 && mistakes === 1) {
      return { correct: false, partial: true };
    }
  } else {
    if (points === 1 && correctElems.length === userElems.length) {
      let matches = 0;
      for (let i = 0; i < correctElems.length; i++) {
        if (userElems[i] === correctElems[i]) matches++;
      }
      if (matches === correctElems.length) {
        return { correct: true, partial: false };
      }
    }

    if (points === 2) {
      // порядок НЕ важен
      const sortedCorrect = [...correctElems].sort();
      const sortedUser = [...userElems].sort();

      if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
        return { correct: true, partial: false };
      }

      // частичное совпадение
      const matches = userElems.filter(e => correctElems.includes(e)).length;
      if (
        ((matches === userElems.length || matches === correctElems.length) &&
          Math.abs(correctElems.length - userElems.length) === 1) ||
        Math.abs(matches - correctElems.length) === 1
      ) {
        return { correct: false, partial: true };
      }
    }
  }

  return { correct: false, partial: false };
}

// === проверка ответа (адаптированная для компонента) ===
function checkAnswerComponent(userAnswerRaw, correctAnswerRaw, points, shortSubject, taskNumberRaw) {
  const userRaw = userAnswerRaw == null ? '' : String(userAnswerRaw).trim();
  if (!userRaw) {
    return { score: 0, isCorrect: false, isPartiallyCorrect: false };
  }

  const variants = splitAnswerVariantsRaw(correctAnswerRaw);
  let anyCorrect = false;
  let anyPartial = false;

  const taskNum = normalizeTaskNumber(taskNumberRaw);
  let orderMatters = false;
  if (points === 2 && shortSubject && taskNum != null) {
    orderMatters = ORDERED_TASKS[shortSubject]?.includes(taskNum) || false;
  }

  for (const variant of variants) {
    if (isDigitSequence(variant) && isDigitSequence(userRaw)) {
      const { correct, partial } = checkNumericAnswer(userRaw, variant, points, orderMatters);
      if (correct) {
        anyCorrect = true;
        break;
      }
      if (partial) {
        anyPartial = true;
      }
    } else {
      if (normalizeText(userRaw) === normalizeText(variant)) {
        anyCorrect = true;
        break;
      }
    }
  }

  const isCorrect = anyCorrect;
  const isPartiallyCorrect = !isCorrect && anyPartial;
  const score = isCorrect ? points : isPartiallyCorrect ? 1 : 0;

  return { score, isCorrect, isPartiallyCorrect };
}

export default {
  name: 'Homework',
  setup() {
    const homeworkData = ref({
      homework_name: '',
      lesson_number: '',
      lesson_name: '',
      deadline: null
    })
    const tasks = ref([])
    const loading = ref(true)
    const error = ref(null)
    const user_id = ref(null)
    const isCompleted = ref(false)
    const totalScore = ref(0)
    const showImageModal = ref(false)
    const selectedImage = ref('')
    const showAnswers = ref(false)
    const subject = ref('') // chemistry или biology
    const examType = ref('') // ege или oge
    const homeworkId = ref('')
    const editInput = ref(null)
    const studentInfo = ref(null) // Информация о студенте для режима куратора

    // Получаем параметры из URL
    const getUrlParams = () => {
      const params = new URLSearchParams(window.location.search)
      const subjectParam = params.get('subject') // chemistry или biology
      const examTypeParam = params.get('exam_type') // ege или oge
      
      // Если exam_type не передан, пытаемся определить из старого формата
      let finalSubject = subjectParam
      let finalExamType = examTypeParam
      
      if (!finalExamType && subjectParam) {
        // Старый формат: subject=chemistry_ege
        if (subjectParam.includes('_')) {
          const parts = subjectParam.split('_')
          finalSubject = parts[0]
          finalExamType = parts[1]
        } else {
          // По умолчанию ЕГЭ для обратной совместимости
          finalExamType = 'ege'
        }
      }

      return {
        subject: finalSubject,
        exam_type: finalExamType,
        homework_id: params.get('homework_id'),
        homework_name: params.get('homework_name'),
        lesson_number: params.get('lesson_number'),
        lesson_name: params.get('lesson_name'),
        view_mode: params.get('view_mode'),
        student_id: params.get('student_id')
      }
    }

    // Функция для получения tutor_name
    const getTutorName = async (studentId) => {
      try {
        console.log('🔍 Поиск tutor для student_id:', studentId);
        
        // Ищем в таблице students в столбце tutor
        const { data, error } = await supabase
          .from('students')
          .select('tutor')
          .eq('user_id', studentId)
          .single();

        if (error) {
          console.error('❌ Ошибка запроса tutor из students:', error);
          throw error;
        }
        
        console.log('✅ Найденные данные из students:', data);
        console.log('📝 tutor:', data?.tutor);
        
        return data?.tutor || null;
      } catch (err) {
        console.error('❌ Ошибка получения tutor:', err);
        return null;
      }
    }

    // Функция создания уведомления (только при завершении домашнего задания)
    const createHomeworkNotification = async (score) => {
      if (!user_id.value) {
        console.error('❌ user_id не установлен');
        return;
      }

      try {
        console.log('👤 Создание уведомления для user_id:', user_id.value);
        
        const tutorName = await getTutorName(user_id.value);
        
        console.log('🎯 Полученный tutor:', tutorName);
        
        const notificationData = {
          student_id: user_id.value,
          homework_id: parseInt(homeworkId.value),
          subject: `${subject.value}_${examType.value}`,
          completed_at: new Date().toISOString(),
          score: score,
          is_read: false,
          tutor_name: tutorName
        };

        console.log('📨 Данные для уведомления:', notificationData);

        const { error } = await supabase
          .from('homework_notifications')
          .upsert(notificationData, {
            onConflict: 'tutor_name,student_id,homework_id'
          });

        if (error) {
          console.error('❌ Ошибка сохранения уведомления:', error);
          throw error;
        }
        
        console.log('✅ Уведомление создано успешно');
        
      } catch (err) {
        console.error('❌ Ошибка создания уведомления:', err);
      }
    }

    const urlParams = getUrlParams()
    subject.value = urlParams.subject
    examType.value = urlParams.exam_type
    homeworkId.value = urlParams.homework_id

    homeworkData.value = {
      homework_name: urlParams.homework_name || '',
      lesson_number: urlParams.lesson_number || '',
      lesson_name: urlParams.lesson_name || '',
      deadline: null
    }

    // Получение ID текущего пользователя
    const getCurrentUserId = async () => {
      if (urlParams.view_mode === 'tutor' && urlParams.student_id) {
        return urlParams.student_id;
      }
      
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) {
          console.error('Ошибка получения пользователя:', authError)
          return null
        }
        return user?.id || null
      } catch (err) {
        console.error('Ошибка получения ID пользователя:', err)
        return null
      }
    }

    const isViewMode = computed(() => {
      return urlParams.view_mode === 'tutor';
    });

    const isTutorMode = computed(() => {
      return urlParams.view_mode === 'tutor';
    });

    // Метод для загрузки информации о студенте (ФИО)
    const loadStudentInfo = async () => {
      if (!user_id.value || !isTutorMode.value) return
      
      try {
        console.log('👤 Загрузка ФИО студента для user_id:', user_id.value)
        
        // Запрос к таблице students для получения first_name и last_name
        const { data, error } = await supabase
          .from('students')
          .select('first_name, last_name')
          .eq('user_id', user_id.value)
          .single()

        if (error) {
          console.error('❌ Ошибка загрузки информации о студенте:', error)
          // Если в таблице students нет данных, попробуем получить из других источников
          const { data: personalityData } = await supabase
            .from('personalities')
            .select('full_name')
            .eq('user_id', user_id.value)
            .single()
            
          if (personalityData) {
            studentInfo.value = { 
              first_name: personalityData.full_name,
              last_name: ''
            }
          } else {
            studentInfo.value = { first_name: 'Не указано', last_name: '' }
          }
        } else {
          studentInfo.value = data
          console.log('✅ ФИО студента:', data)
        }
        
      } catch (err) {
        console.error('❌ Ошибка при загрузке информации о студенте:', err)
        studentInfo.value = { first_name: 'Ошибка загрузки', last_name: '' }
      }
    }

    // Получение названий таблиц на основе subject и examType
    const getTableNames = () => {
      if (!subject.value || !examType.value) {
        throw new Error('Не указаны subject и exam_type')
      }
      
      const baseTable = `${subject.value}_${examType.value}`
      return {
        homeworkList: `${baseTable}_homework_list`,
        homeworkTasks: `${baseTable}_homework_tasks`,
        taskBank: `${baseTable}_task_bank`,
        progress: `${baseTable}_progress`,
        homeworkCompleted: `${baseTable}_homework_completed`
      }
    }

    // Метод для перенаправления в меню
    async function redirectToMenu() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) throw userError;
        if (!user) {
          window.location.href = '/login.html';
          return;
        }

        const { data: personalityData, error: personalityError } = await supabase
          .from('personalities')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (personalityError) throw personalityError;
        if (!personalityData) {
          alert('Профиль пользователя не найден');
          return;
        }

        switch(personalityData.role) {
          case 'student':
            window.location.href = '/student_menu.html';
            break;
          case 'teacher':
            window.location.href = '/teacher_menu.html';
            break;
          case 'tutor':
            window.location.href = '/tutor_menu.html';
            break;
          default:
            alert('Неизвестная роль пользователя');
        }
      } catch (err) {
        console.error('Ошибка при перенаправлении:', err);
        alert('Произошла ошибка при переходе на главную');
      }
    }

    // Санитизация HTML
    const sanitizeHtml = (html) => {
      if (!html) return ''
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'sub', 'sup', 'ul', 'ol', 'li', 'div', 'span', 'table', 'tr', 'td', 'th', 'tbody', 'thead'],
        ALLOWED_ATTR: ['style', 'class', 'colspan', 'rowspan']
      })
    }

    // Форматирование текста с абзацами
    const formatTextWithParagraphs = (text) => {
      if (!text) return '';
      
      // Если текст уже содержит HTML-теги (кроме простых тегов форматирования), возвращаем как есть
      const hasComplexHTML = /<(?!\/?(sub|sup|br|strong|em|p)\b)[^>]+>/i.test(text);
      
      if (hasComplexHTML) {
        return text;
      }
      
      // Обрабатываем только простой текст без сложной HTML-разметки
      let formattedText = text
        .trim()
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
      
      if (!formattedText.startsWith('<p>') && !formattedText.includes('</p>')) {
        formattedText = `<p>${formattedText}</p>`;
      }
      
      return formattedText;
    }

    // Форматирование текста ответа
    const formatAnswerText = (text) => {
      if (!text) return '';
      
      let formattedText = String(text);
      
      // Обработка химических формул (например, H2O → H₂O)
      formattedText = formattedText.replace(/([A-Za-z])(\d+)/g, '$1<sub>$2</sub>');
      
      // Обработка степеней (например, x^2 → x²)
      formattedText = formattedText.replace(/(\w)\^(\d+)/g, '$1<sup>$2</sup>');
      
      // Обработка специальных тегов [sub] и [sup]
      formattedText = formattedText.replace(/\[sub\](.*?)\[\/sub\]/g, '<sub>$1</sub>');
      formattedText = formattedText.replace(/\[sup\](.*?)\[\/sup\]/g, '<sup>$1</sup>');
      
      // Переносы строк
      formattedText = formattedText.replace(/\n/g, '<br>');
      
      return formattedText;
    }

    // Получение текста задания без таблиц
    const getTaskTextWithoutTables = (task) => {
      if (!task.text) return '';
      
      // Если есть табличные данные в отдельном поле, показываем текст без таблиц
      if (task.has_table && task.table_data) {
        return formatTextWithParagraphs(task.text.replace(/<table[\s\S]*?<\/table>/gi, ''));
      }
      
      // Если это HTML-таблица в тексте, возвращаем весь текст
      return formatTextWithParagraphs(task.text);
    }

    // Получение пояснения с поддержкой изображений
    const getExplanationContent = (task) => {
      let content = '';
      
      // Добавляем текстовое пояснение с абзацами
      if (task.explanation) {
        content += formatTextWithParagraphs(task.explanation);
      }
      
      // Добавляем изображения пояснения если есть (обрабатываем массив)
      if (task.image_explanation && Array.isArray(task.image_explanation)) {
        task.image_explanation.forEach(imagePath => {
          if (typeof imagePath === 'string') {
            const imageUrl = getImageUrl(imagePath);
            content += `<div class="explanation-image-container">
              <img src="${imageUrl}" alt="Пояснение к заданию" class="explanation-image">
            </div>`;
          }
        });
      } else if (typeof task.image_explanation === 'string') {
        // Обработка для случая, когда image_explanation - строка
        const imageUrl = getImageUrl(task.image_explanation);
        content += `<div class="explanation-image-container">
          <img src="${imageUrl}" alt="Пояснение к заданию" class="explanation-image">
        </div>`;
      }
      
      return content;
    }

    // Получение URL изображения
    const getImageUrl = (imagePath) => {
      if (!imagePath) return '';
      if (typeof imagePath !== 'string') return '';
      if (imagePath.startsWith('http')) return imagePath;
      
      try {
        const { data: { publicUrl } } = supabase
          .storage
          .from('task-images')
          .getPublicUrl(imagePath);
        return publicUrl;
      } catch (err) {
        console.error('Ошибка получения URL изображения:', err);
        return '';
      }
    }

    // Получение URL изображения ответа
    const getAnswerImageUrl = (imagePath) => {
      if (!imagePath) return '';
      if (imagePath.startsWith('http')) return imagePath;
      
      try {
        const { data: { publicUrl } } = supabase
          .storage
          .from('answers')
          .getPublicUrl(imagePath);
        return publicUrl;
      } catch (err) {
        console.error('Ошибка получения URL изображения ответа:', err);
        return '';
      }
    }

    // Загрузка изображения ответа
    const uploadAnswerImage = async (task, file) => {
      if (!user_id.value) return null;

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user_id.value}/${task.task_id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase
          .storage
          .from('answers')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        return fileName;
      } catch (err) {
        console.error('Ошибка загрузки изображения:', err);
        error.value = 'Ошибка загрузки изображения: ' + err.message;
        return null;
      }
    }

    // Удаление изображения ответа
    const deleteAnswerImage = async (imagePath) => {
      try {
        const { error: deleteError } = await supabase
          .storage
          .from('answers')
          .remove([imagePath]);

        if (deleteError) throw deleteError;
      } catch (err) {
        console.error('Ошибка удаления изображения:', err);
      }
    }

    // Начать редактирование ответа
    const startEdit = (task) => {
      task.isEditing = true;
      task.editAnswerInput = task.userAnswer || '';
      
      nextTick(() => {
        const input = document.querySelector(`.task-item[data-task-id="${task.task_id}"] .answer-input, .task-item[data-task-id="${task.task_id}"] .answer-textarea`);
        if (input) {
          input.focus();
          input.select();
        }
      });
    }

    // Отменить редактирование
    const cancelEdit = (task) => {
      task.isEditing = false;
      task.editAnswerInput = '';
    }

    // Сохранение отредактированного ответа
    const saveEditedAnswer = async (task) => {
      if (!task.editAnswerInput.trim() && (!task.answerImages || task.answerImages.length === 0)) {
        alert('Пожалуйста, введите ответ или прикрепите изображение');
        return;
      }

      try {
        task.saving = true;
        const userAnswer = task.editAnswerInput.trim();
        
        task.userAnswer = userAnswer; 
        task.userAnswerInput = userAnswer;
        task.isEditing = false;
        
        await saveTaskProgress(task, false);
        
        task.saving = false;
        
      } catch (err) {
        console.error('Ошибка сохранения отредактированного ответа:', err);
        task.saving = false;
        error.value = 'Ошибка при сохранении ответа: ' + err.message;
      }
    }

    // Сохранение ответа
    const saveAnswer = async (task) => {
      if (!task.userAnswerInput.trim() && (!task.answerImages || task.answerImages.length === 0)) {
        alert('Пожалуйста, введите ответ или прикрепите изображение');
        return;
      }

      try {
        task.saving = true;
        const userAnswer = task.userAnswerInput.trim();
        
        task.userAnswer = userAnswer;
        
        await saveTaskProgress(task, false);
        
        // Устанавливаем флаг, что ответ сохранен
        task.answerSaved = true;
        setTimeout(() => {
          task.answerSaved = false;
        }, 3000);
        
        task.saving = false;

      } catch (err) {
        console.error('Ошибка сохранения ответа:', err);
        task.saving = false;
        error.value = 'Ошибка при сохранении ответа: ' + err.message;
      }
    }

    // Сохранение прогресса выполнения задания
// Сохранение прогресса выполнения задания
const saveTaskProgress = async (task, checkCorrectness = false) => {
  if (!user_id.value) return;

  let score = 0;
  let is_completed = false;
  let counted_in_rating = false;

  if (checkCorrectness) {
    const result = checkAnswerComponent(
      task.userAnswer,
      task.answer,
      task.points,
      subject.value,
      task.exam_task_number
    );

    score = result.score;
    is_completed = result.isCorrect || result.isPartiallyCorrect;
    counted_in_rating = result.isCorrect;

    task.isCorrect = result.isCorrect;
    task.isPartiallyCorrect = result.isPartiallyCorrect;
    task.awardedPoints = score;
  }

  try {
    const tableNames = getTableNames();
    const now = new Date().toISOString();
    
    // Данные для таблицы прогресса
    const progressData = {
      user_id: user_id.value,
      task_id: task.task_id,
      is_completed: is_completed,
      score: score,
      user_answer: task.userAnswer || '',
      answer_images: task.answerImages || [],
      last_updated: now,
      counted_in_rating: counted_in_rating
    };

    // Сохраняем в таблицу прогресса
    const { error: progressError } = await supabase
      .from(tableNames.progress)
      .upsert(progressData, {
        onConflict: 'user_id,task_id'
      });

    if (progressError) throw progressError;

    // === ДОБАВЛЯЕМ ЗАПИСЬ В ML ТАБЛИЦУ ===
    // Название ML таблицы: ml_{subject}_{examType}
    const mlTableName = `ml_${subject.value}_${examType.value}`;
    
    // Получаем данные задания из task_bank для ML
    const { data: taskData, error: taskError } = await supabase
      .from(tableNames.taskBank)
      .select('number, section, topic, difficulty, points')
      .eq('id', task.task_id)
      .single();

    if (taskError) {
      console.error('Ошибка получения данных задания для ML:', taskError);
    } else {
      // Вставляем запись в ML таблицу
      const mlData = {
        user_id: user_id.value,
        task_id: task.task_id,
        number: taskData.number,
        section: taskData.section,
        topic: taskData.topic,
        difficulty: taskData.difficulty,
        max_score: taskData.points,
        is_correct: counted_in_rating, // true только если полный балл
        score: score,
        created_at: now
      };

      const { error: mlError } = await supabase
        .from(mlTableName)
        .insert([mlData]);

      if (mlError) {
        console.error('Ошибка сохранения в ML таблицу:', mlError);
      } else {
        console.log('✅ Данные сохранены в ML таблицу:', mlTableName);
      }
    }

  } catch (err) {
    console.error('Ошибка сохранения прогресса:', err);
    throw err;
  }
};

    // Функция для выставления баллов куратором
// Функция для выставления баллов куратором
const setTutorScore = async (task, manualScore) => {
  if (!isTutorMode.value || !user_id.value) return;
  
  try {
    task.saving = true;
    
    task.awardedPoints = manualScore;
    task.isCorrect = manualScore === task.points;
    task.isPartiallyCorrect = manualScore > 0 && manualScore < task.points;
    
    const counted_in_rating = manualScore === task.points;
    const now = new Date().toISOString();
    
    const tableNames = getTableNames();
    
    // Сохраняем в таблицу прогресса
    const { error: progressError } = await supabase
      .from(tableNames.progress)
      .upsert({
        user_id: user_id.value,
        task_id: task.task_id,
        is_completed: manualScore > 0,
        score: manualScore,
        user_answer: task.userAnswer || '',
        answer_images: task.answerImages || [],
        last_updated: now,
        counted_in_rating: counted_in_rating
      }, {
        onConflict: 'user_id,task_id'
      });

    if (progressError) throw progressError;
    
    // === ДОБАВЛЯЕМ ЗАПИСЬ В ML ТАБЛИЦУ ДЛЯ КУРАТОРА ===
    const mlTableName = `ml_${subject.value}_${examType.value}`;
    
    const { data: taskData, error: taskError } = await supabase
      .from(tableNames.taskBank)
      .select('number, section, topic, difficulty, points')
      .eq('id', task.task_id)
      .single();

    if (!taskError && taskData) {
      const mlData = {
        user_id: user_id.value,
        task_id: task.task_id,
        number: taskData.number,
        section: taskData.section,
        topic: taskData.topic,
        difficulty: taskData.difficulty,
        max_score: taskData.points,
        is_correct: counted_in_rating,
        score: manualScore,
        created_at: now
      };

      const { error: mlError } = await supabase
        .from(mlTableName)
        .insert([mlData]);

      if (mlError) {
        console.error('Ошибка сохранения в ML таблицу (куратор):', mlError);
      }
    }
    
    // Обновляем только homework_completed, без создания уведомления
    await updateHomeworkCompletedOnly();
    
  } catch (err) {
    console.error('Ошибка сохранения баллов куратора:', err);
    error.value = 'Ошибка при сохранении баллов: ' + err.message;
  } finally {
    task.saving = false;
  }
};

    // Обновление только homework_completed (без уведомлений)
    const updateHomeworkCompletedOnly = async () => {
      if (!user_id.value) return;
      
      const newTotalScore = tasks.value.reduce((sum, task) => sum + (task.awardedPoints || 0), 0);
      
      try {
        const tableNames = getTableNames();
        
        // Обновляем homework_completed без создания уведомления
        const { error } = await supabase
          .from(tableNames.homeworkCompleted)
          .upsert({
            homework_id: parseInt(homeworkId.value),
            user_id: user_id.value,
            is_completed: true,
            score: newTotalScore,
            completed_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,homework_id'
          });

        if (error) throw error;
        
        totalScore.value = newTotalScore;
        
      } catch (err) {
        console.error('Ошибка обновления общего балла:', err);
      }
    };

    // Обновление общего балла домашнего задания
    const updateHomeworkTotalScore = async () => {
      if (!user_id.value) return;
      
      const newTotalScore = tasks.value.reduce((sum, task) => sum + (task.awardedPoints || 0), 0);
      
      try {
        const tableNames = getTableNames();
        
        // 1. Обновляем homework_completed
        const { error } = await supabase
          .from(tableNames.homeworkCompleted)
          .upsert({
            homework_id: parseInt(homeworkId.value),
            user_id: user_id.value,
            is_completed: true,
            score: newTotalScore,
            completed_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,homework_id'
          });

        if (error) throw error;
        
        // 2. Создаем/обновляем уведомление (только если не в режиме куратора)
        if (!isTutorMode.value) {
          await createHomeworkNotification(newTotalScore);
        }
        
        totalScore.value = newTotalScore;
        
      } catch (err) {
        console.error('Ошибка обновления общего балла:', err);
      }
    };

    // Завершение домашнего задания
    const completeHomework = async () => {
      try {
        error.value = null;
        
        updateTotalScore();

        // Сохраняем прогресс по всем заданиям
        for (const task of tasks.value) {
          if (task.userAnswer || (task.answerImages && task.answerImages.length > 0)) {
            await saveTaskProgress(task, true);
          }
        }

        updateTotalScore();

        const tableNames = getTableNames();
        
        // 1. Сохраняем в homework_completed
        const completionData = {
          homework_id: parseInt(homeworkId.value),
          user_id: user_id.value,
          is_completed: true,
          score: totalScore.value,
          completed_at: new Date().toISOString()
        };

        const { error: completionError } = await supabase
          .from(tableNames.homeworkCompleted)
          .upsert(completionData, {
            onConflict: 'user_id,homework_id'
          });

        if (completionError) {
          console.error('Ошибка Supabase:', completionError);
          throw new Error(completionError.message);
        }

        // 2. Создаем уведомление (только для студентов)
        if (!isTutorMode.value) {
          await createHomeworkNotification(totalScore.value);
        }

        isCompleted.value = true;
        showAnswers.value = true;
        
        alert('Домашнее задание завершено! Набрано баллов: ' + totalScore.value + '/' + maxScore.value);

      } catch (err) {
        error.value = err.message;
        console.error('Полная ошибка завершения домашнего задания:', err);
        alert('Ошибка: ' + err.message);
      }
    }

    // Загрузка заданий домашнего задания
    const fetchHomeworkTasks = async () => {
      try {
        loading.value = true
        error.value = null
        user_id.value = await getCurrentUserId()

        if (!user_id.value) {
          throw new Error('Пользователь не авторизован')
        }

        if (!subject.value || !examType.value || !homeworkId.value) {
          throw new Error('Не указаны параметры домашнего задания (subject, exam_type, homework_id)')
        }

        const tableNames = getTableNames();

        // ДОБАВИМ ОТЛАДКУ ДЛЯ OGE
        console.log('=== OGE DEBUG INFO ===');
        console.log('subject:', subject.value);
        console.log('examType:', examType.value); 
        console.log('homeworkId:', homeworkId.value);
        console.log('tableNames:', tableNames);
        console.log('=====================');
        
        const { data: homeworkInfo, error: homeworkInfoError } = await supabase
          .from(tableNames.homeworkList)
          .select('deadline, homework_name, lesson_number, lesson_name')
          .eq('homework_id', homeworkId.value)
          .single()

        if (homeworkInfoError) {
          console.error('Ошибка загрузки информации о домашнем задании:', homeworkInfoError)
        } else if (homeworkInfo) {
          homeworkData.value = {
            ...homeworkData.value,
            deadline: homeworkInfo.deadline,
            homework_name: homeworkInfo.homework_name || homeworkData.value.homework_name,
            lesson_number: homeworkInfo.lesson_number || homeworkData.value.lesson_number,
            lesson_name: homeworkInfo.lesson_name || homeworkData.value.lesson_name
          }
        }

        const { data: homeworkTasks, error: homeworkError } = await supabase
          .from(tableNames.homeworkTasks)
          .select('*')
          .eq('homework_id', homeworkId.value)
          .order('number', { ascending: true })

        if (homeworkError) {
          throw new Error('Не удалось загрузить задания: ' + homeworkError.message)
        }

        if (!homeworkTasks || homeworkTasks.length === 0) {
          throw new Error('Задания для этого домашнего задания не найдены')
        }

        const taskIds = homeworkTasks.map(task => task.task_id)
        const { data: taskDetails, error: taskError } = await supabase
          .from(tableNames.taskBank)
          .select('*')
          .in('id', taskIds)

        if (taskError) {
          throw new Error('Не удалось загрузить детали заданий: ' + taskError.message)
        }

        console.log('taskDetails:', taskDetails);
        if (taskDetails && taskDetails.length > 0) {
          console.log('Первая задача из task_bank:', taskDetails[0]);
          console.log('Доступные поля:', Object.keys(taskDetails[0]));
        }

        tasks.value = homeworkTasks.map(homeworkTask => {
          const taskDetail = taskDetails.find(t => t.id === homeworkTask.task_id)
          return {
            ...homeworkTask,
            ...taskDetail,
            number: homeworkTask.number, 
            exam_task_number: taskDetail.number, // ← глобальный номер из task_bank для проверки
            userAnswerInput: '',
            userAnswer: null,
            answerImages: [],
            answerSaved: false, 
            isCorrect: false,
            isPartiallyCorrect: false,
            awardedPoints: 0,
            saving: false,
            isEditing: false,
            editAnswerInput: '',
            manualScore: 0,
            uploadingImages: false,
            showExplanation: false
          }
        })

        await loadTasksProgress()
        await checkHomeworkCompletion()

        // Загружаем информацию о студенте если это режим куратора
        if (isTutorMode.value) {
          await loadStudentInfo();
        }

        // Привязываем обработчики изображений после загрузки
        if (showAnswers.value) {
          nextTick(() => {
            bindExplanationImageHandlers();
          });
        }

      } catch (err) {
        error.value = err.message
        console.error('Ошибка загрузки заданий:', err)
      } finally {
        loading.value = false
      }
    }

    // Загрузка прогресса выполнения заданий
    const loadTasksProgress = async () => {
      if (!user_id.value) return

      try {
        const tableNames = getTableNames();
        const taskIds = tasks.value.map(task => task.task_id)
        
        const { data: progressData, error: progressError } = await supabase
          .from(tableNames.progress)
          .select('*')
          .eq('user_id', user_id.value)
          .in('task_id', taskIds)

        if (progressError) {
          console.error('Ошибка загрузки прогресса:', progressError)
          return
        }

        const { data: completionData } = await supabase
          .from(tableNames.homeworkCompleted)
          .select('is_completed')
          .eq('homework_id', homeworkId.value)
          .eq('user_id', user_id.value)
          .maybeSingle()

        showAnswers.value = completionData?.is_completed || isTutorMode.value;

        tasks.value = tasks.value.map(task => {
          const progress = progressData?.find(p => p.task_id === task.task_id)
          if (progress) {
            return {
              ...task,
              userAnswer: progress.user_answer,
              answerImages: progress.answer_images || [],
              isCorrect: showAnswers.value ? progress.score === task.points : false,
              isPartiallyCorrect: showAnswers.value ? (progress.score > 0 && progress.score < task.points) : false,
              awardedPoints: showAnswers.value ? progress.score : 0,
              manualScore: progress.score || 0
            }
          }
          return task
        })

      } catch (err) {
        console.error('Ошибка загрузки прогресса:', err)
      }
    }

    // Проверка статуса выполнения домашнего задания
    const checkHomeworkCompletion = async () => {
      if (!user_id.value) return

      try {
        const tableNames = getTableNames();
        const { data: completionData, error: completionError } = await supabase
          .from(tableNames.homeworkCompleted)
          .select('*')
          .eq('homework_id', homeworkId.value)
          .eq('user_id', user_id.value)
          .maybeSingle()

        if (completionError && completionError.code !== 'PGRST116') {
          console.error('Ошибка проверки статуса выполнения:', completionError)
          return
        }

        if (completionData) {
          isCompleted.value = completionData.is_completed
          totalScore.value = completionData.score || 0
          showAnswers.value = completionData.is_completed || isTutorMode.value
        }

      } catch (err) {
        console.error('Ошибка проверки статуса выполнения:', err)
      }
    }

    // Обработка загрузки изображений для ответа
    const handleImageUpload = async (task, event) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      try {
        task.uploadingImages = true;
        const newImages = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, загружайте только изображения');
            continue;
          }

          if (file.size > 25 * 1024 * 1024) {
            alert('Размер файла не должен превышать 25MB');
            continue;
          }

          const imagePath = await uploadAnswerImage(task, file);
          if (imagePath) {
            newImages.push(imagePath);
          }
        }

        if (newImages.length > 0) {
          task.answerImages = [...(task.answerImages || []), ...newImages];
          task.userAnswerInput = '';
          task.userAnswer = '';
          
          // Устанавливаем флаг, что ответ сохранен (для изображений)
          task.answerSaved = true;
          await saveTaskProgress(task, false);
          
          // Скрываем сообщение через 3 секунды
          setTimeout(() => {
            task.answerSaved = false;
          }, 3000);
        }

      } catch (err) {
        console.error('Ошибка загрузки изображений:', err);
        error.value = 'Ошибка при загрузке изображений: ' + err.message;
      } finally {
        task.uploadingImages = false;
        event.target.value = '';
      }
    }

    // Привязка обработчиков к изображениям пояснений
    const bindExplanationImageHandlers = () => {
      const explanationImages = document.querySelectorAll('.explanation-image');
      explanationImages.forEach(img => {
        // Удаляем старые обработчики
        img.onclick = null;
        // Добавляем новые
        img.onclick = () => {
          openImageModal(img.src);
        };
      });
    }

    // Переключение отображения пояснения
    const toggleExplanation = (task) => {
      task.showExplanation = !task.showExplanation;
      
      // После переключения привязываем обработчики к новым изображениям
      if (task.showExplanation) {
        nextTick(() => {
          bindExplanationImageHandlers();
        });
      }
    }

    // Удаление изображения ответа
    const removeAnswerImage = async (task, imageIndex) => {
      try {
        const imageToRemove = task.answerImages[imageIndex];
        
        await deleteAnswerImage(imageToRemove);
        task.answerImages.splice(imageIndex, 1);
        await saveTaskProgress(task, false);
        
      } catch (err) {
        console.error('Ошибка удаления изображения:', err);
        error.value = 'Ошибка при удалении изображения: ' + err.message;
      }
    }

    // Открытие модального окна с изображением
    const openImageModal = (imageUrl) => {
      selectedImage.value = imageUrl
      showImageModal.value = true
      document.body.style.overflow = 'hidden'
    }

    const closeImageModal = () => {
      showImageModal.value = false
      document.body.style.overflow = ''
    }

    // Форматирование даты
    const formatDate = (dateString) => {
      if (!dateString) return 'Не указан'
      try {
        return new Date(dateString).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      } catch (err) {
        return 'Неверный формат даты'
      }
    }

    // Обновляем общий балл
    const updateTotalScore = () => {
      totalScore.value = tasks.value.reduce((sum, task) => sum + (task.awardedPoints || 0), 0)
    }
    
    const completionPercent = computed(() => {
      if (maxScore.value === 0) return 0;
      return Math.round((totalScore.value / maxScore.value) * 100);
    });

    // Получение полного имени студента
    const studentFullName = computed(() => {
      if (!studentInfo.value) return 'Загрузка...';
      const { first_name = '', last_name = '' } = studentInfo.value;
      return `${last_name} ${first_name}`.trim() || 'Не указано';
    });

    // Статус дедлайна
    const deadlineStatus = computed(() => {
      const deadline = homeworkData.value.deadline
      if (!deadline) return 'no-deadline'
      
      try {
        const deadlineDate = new Date(deadline)
        const today = new Date()
        
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const deadlineDateOnly = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate())
        
        if (deadlineDateOnly < todayDate) return 'overdue'
        if (deadlineDateOnly.getTime() === todayDate.getTime()) return 'today'
        return 'future'
      } catch (err) {
        return 'no-deadline'
      }
    })

    // Отсортированные задания по номеру
    const sortedTasks = computed(() => {
      return [...tasks.value].sort((a, b) => a.number - b.number)
    })

    // Есть ли ответы на задания
    const hasAnswers = computed(() => {
      return tasks.value.some(task => task.userAnswer || (task.answerImages && task.answerImages.length > 0))
    })

    // Максимальный возможный балл
    const maxScore = computed(() => {
      return tasks.value.reduce((sum, task) => sum + (task.points || 0), 0)
    })

    // Статус задания
    const getTaskStatusClass = (task) => {
      if (!task.userAnswer && (!task.answerImages || task.answerImages.length === 0)) return 'status-not-completed'
      if (!showAnswers.value) return 'status-saved'
      if (task.isCorrect) return 'status-correct'
      if (task.isPartiallyCorrect) return 'status-partial'
      return 'status-incorrect'
    }

    const getTaskStatusText = (task) => {
      if (!task.userAnswer && (!task.answerImages || task.answerImages.length === 0)) return 'Не решено'
      if (!showAnswers.value) return 'Ответ сохранен'
      if (task.isCorrect) return `✓ Верно (${task.awardedPoints}/${task.points} балла)`
      if (task.isPartiallyCorrect) return `± Частично (${task.awardedPoints}/${task.points} балла)`
      return `✗ Неверно (0/${task.points} балла)`
    }

    // Класс для фидбека
    const getFeedbackClass = (task) => {
      if (task.isCorrect) return 'correct-feedback'
      if (task.isPartiallyCorrect) return 'partial-feedback'
      return 'incorrect-feedback'
    }

    const getFeedbackText = (task) => {
      return '';
    }

    // Проверяем, является ли задание второй частью
    const isSecondPartTask = (task) => {
      return task.part === 'Вторая часть';
    }

    // Получение отображаемого названия предмета
    const getDisplaySubjectName = computed(() => {
      const subjectNames = {
        'chemistry': 'Химия',
        'biology': 'Биология'
      };
      const examTypeNames = {
        'ege': 'ЕГЭ',
        'oge': 'ОГЭ'
      };
      
      const subjectName = subjectNames[subject.value] || subject.value;
      const examTypeName = examTypeNames[examType.value] || examType.value;
      
      return `${subjectName} ${examTypeName}`;
    });

    // Следим за изменениями баллов
    onMounted(() => {
      if (subject.value && examType.value && homeworkId.value) {
        fetchHomeworkTasks()
      } else {
        error.value = 'Не указаны параметры домашнего задания (subject, exam_type, homework_id)'
        loading.value = false
      }

      // Исправленные обработчики событий
      document.addEventListener('contextmenu', (e) => {
        const target = e.target;
        if (target && typeof target.closest === 'function' && target.closest('.task-text')) {
          e.preventDefault()
          return false
        }
      })
      
      document.addEventListener('selectstart', (e) => {
        const target = e.target;
        if (target && typeof target.closest === 'function' && target.closest('.task-text')) {
          e.preventDefault()
          return false
        }
      })
    })

    watch(() => tasks.value.map(t => t.awardedPoints), () => {
      updateTotalScore()
    }, { deep: true })

    // При изменении showAnswers привязываем обработчики
    watch(showAnswers, (newVal) => {
      if (newVal) {
        nextTick(() => {
          bindExplanationImageHandlers();
        });
      }
    })

    return {
      homeworkName: homeworkData.value.homework_name,
      homeworkData,
      sortedTasks,
      loading,
      error,
      isCompleted,
      totalScore,
      maxScore,
      showImageModal,
      selectedImage,
      showAnswers,
      sanitizeHtml,
      formatTextWithParagraphs,
      formatAnswerText,
      getImageUrl,
      getAnswerImageUrl,
      getTaskTextWithoutTables,
      getExplanationContent,
      saveAnswer,
      completeHomework,
      formatDate,
      deadlineStatus,
      getTaskStatusClass,
      getTaskStatusText,
      getFeedbackClass,
      getFeedbackText,
      openImageModal,
      closeImageModal,
      hasAnswers,
      redirectToMenu, 
      isViewMode,
      isTutorMode,
      startEdit,
      cancelEdit,
      saveEditedAnswer,
      setTutorScore,
      updateHomeworkTotalScore,
      handleImageUpload,
      removeAnswerImage,
      isSecondPartTask,
      toggleExplanation,
      getDisplaySubjectName,
      completionPercent,
      studentFullName,
      loadStudentInfo,
      updateHomeworkCompletedOnly
    }
  }
}
</script>

<template>
  <div class="allpage">
    <div class="topmenu">
      <div class="logo">НЕОНЛАЙН ШКОЛА PURTO</div>
      <div class="rightparttopmenu">
        <div class="redirect_menu" @click="redirectToMenu">На главную</div>
        <div class="go_back"><a href="index.html">Выйти</a></div>
      </div>
    </div> 
    
    <div class="centerpartpage">
      <div class="homework-content">
        <!-- Заголовок домашнего задания -->
        <div class="homework-header">
          <h1>{{ homeworkName }}</h1>
          <div v-if="isTutorMode" class="tutor-mode-banner">
            📝 Режим проверки куратора
          </div>
          <div class="homework-meta">
            <span class="lesson-info">Урок {{ homeworkData.lesson_number || 'Н/Д' }}: {{ homeworkData.lesson_name || 'Н/Д' }}</span>
            <span class="deadline" :class="deadlineStatus">
              Дедлайн: {{ formatDate(homeworkData.deadline) }}
            </span>
          </div>
        </div>

        <!-- Список заданий -->
        <div class="tasks-container">
          <div v-if="loading" class="loading">Загрузка заданий...</div>
          <div v-else-if="error" class="error">{{ error }}</div>
          
          <div v-else class="tasks-list">
            <div 
              v-for="task in sortedTasks" 
              :key="task.task_id"
              class="task-item"
              :class="{ 'extended-task': isSecondPartTask(task) }"
              :data-task-id="task.task_id"
            >
              <div class="task-card">
                <div class="task-header">
                  <div class="task-meta">
                    <span class="task-topic">Тема: {{ task.topic }}</span>
                    <span class="task-id">#{{ task.number }} ({{ task.points }} балла)</span>
                    <span v-if="isSecondPartTask(task)" class="task-part-badge">Вторая часть</span>
                  </div>
                  <div class="task-status" :class="getTaskStatusClass(task)">
                    {{ getTaskStatusText(task) }}
                  </div>
                </div>

                <div class="task-content">
                  <div 
                    class="task-text" 
                    v-html="sanitizeHtml(getTaskTextWithoutTables(task))"
                    @copy.prevent
                    @cut.prevent
                    @dragstart.prevent
                  ></div>
                  
                  <div v-if="task.has_table && task.table_data" class="task-table-container">
                    <table :class="{ 'with-borders': task.table_data.borders }">
                      <tr v-for="(row, rowIndex) in task.table_data.content" :key="'row-'+rowIndex">
                        <td v-for="(cell, colIndex) in row" :key="'cell-'+rowIndex+'-'+colIndex">
                          <div v-html="sanitizeHtml(cell || '&nbsp;')"></div>
                        </td>
                      </tr>
                    </table>
                  </div>
                  
                  <div class="task-images" v-if="task.images && task.images.length">
                    <div class="image-grid">
                      <div 
                        class="image-container" 
                        v-for="(image, index) in task.images" 
                        :key="index"
                      >
                        <img 
                          :src="getImageUrl(image)" 
                          :alt="'Изображение задания ' + task.number" 
                          class="task-image"
                          @click="openImageModal(getImageUrl(image))"
                          loading="lazy"
                        >
                      </div>
                    </div>
                  </div>

                  <div class="answer-section">
                    <!-- Режим редактирования -->
                    <div v-if="task.isEditing" class="edit-mode">
                      <div class="answer-input-container">
                        <!-- Для второй части - textarea -->
                        <textarea 
                          v-if="isSecondPartTask(task)"
                          v-model="task.editAnswerInput" 
                          :placeholder="'Введите развернутый ответ (' + task.points + ' балла)'" 
                          class="answer-textarea extended"
                          rows="6"
                          @keydown.ctrl.enter="saveEditedAnswer(task)"
                          ref="editInput"
                        ></textarea>
                        
                        <!-- Для первой части - обычный input -->
                        <input 
                          v-else
                          v-model="task.editAnswerInput" 
                          type="text" 
                          :placeholder="'Введите ответ (' + task.points + ' балла)'" 
                          class="answer-input"
                          @keyup.enter="saveEditedAnswer(task)"
                          ref="editInput"
                        >
                        
                        <button @click="saveEditedAnswer(task)" class="submit-button">Сохранить</button>
                        <button @click="cancelEdit(task)" class="cancel-button">Отмена</button>
                      </div>
                      
                      <!-- Загрузка изображений для второй части -->
                      <div v-if="isSecondPartTask(task)" class="image-upload-section">
                        <label class="upload-label">
                          📎 Прикрепить изображения
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            @change="handleImageUpload(task, $event)"
                            class="file-input"
                          >
                        </label>
                        
                        <div v-if="task.uploadingImages" class="upload-status-uploading">
                          ⏳ Загрузка изображений...
                        </div>
                        
                        <div v-if="task.uploadSuccess" class="upload-status-success">
                          ✅ Изображения успешно сохранены!
                        </div>
                        
                        <!-- Отображение загруженных изображений -->
                        <div v-if="task.answerImages && task.answerImages.length > 0" class="answer-images-preview">
                          <div class="images-title">Загруженные изображения:</div>
                          <div class="images-grid">
                            <div v-for="(imagePath, imgIndex) in task.answerImages" :key="imgIndex" class="image-item">
                              <img 
                                :src="getAnswerImageUrl(imagePath)" 
                                :alt="'Изображение ответа ' + (imgIndex + 1)"
                                class="answer-image"
                                @click="openImageModal(getAnswerImageUrl(imagePath))"
                              >
                              <button 
                                @click="removeAnswerImage(task, imgIndex)"
                                class="remove-image-btn"
                                title="Удалить изображение"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <button @click="saveAnswer(task)" class="save-images-btn">
                            💾 Сохранить изменения
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Режим ввода нового ответа -->
                    <div v-else-if="!task.userAnswer && !isViewMode && !isCompleted">
                      <!-- Показываем поле ввода только если нет изображений -->
                      <div v-if="!task.answerImages || task.answerImages.length === 0" class="answer-input-container">
                        <!-- Для второй части - textarea -->
                        <textarea 
                          v-if="isSecondPartTask(task)"
                          v-model="task.userAnswerInput" 
                          :placeholder="'Введите развернутый ответ (' + task.points + ' балла)'" 
                          class="answer-textarea extended"
                          rows="6"
                          @keydown.ctrl.enter="saveAnswer(task)"
                        ></textarea>
                        
                        <!-- Для первой части - обычный input -->
                        <input 
                          v-else
                          v-model="task.userAnswerInput" 
                          type="text" 
                          :placeholder="'Введите ответ (' + task.points + ' балла)'" 
                          class="answer-input"
                          @keyup.enter="saveAnswer(task)"
                        >
                        
                        <button @click="saveAnswer(task)" class="submit-button">Сохранить</button>
                      </div>
                      
                      <!-- Загрузка изображений для второй части -->
                      <div v-if="isSecondPartTask(task)" class="image-upload-section">
                        <label class="upload-label">
                          📎 Прикрепить изображения
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            @change="handleImageUpload(task, $event)"
                            class="file-input"
                          >
                        </label>
                        <div v-if="task.uploadingImages" class="uploading-text">
                          Загрузка...
                        </div>
                        
                        <!-- Отображение загруженных изображений -->
                        <div v-if="task.answerImages && task.answerImages.length > 0" class="answer-images-preview">
                          <div class="images-title">Загруженные изображения:</div>
                          <div class="images-grid">
                            <div v-for="(imagePath, imgIndex) in task.answerImages" :key="imgIndex" class="image-item">
                              <img 
                                :src="getAnswerImageUrl(imagePath)" 
                                :alt="'Изображение ответа ' + (imgIndex + 1)"
                                class="answer-image"
                                @click="openImageModal(getAnswerImageUrl(imagePath))"
                              >
                              <button 
                                @click="removeAnswerImage(task, imgIndex)"
                                class="remove-image-btn"
                                title="Удалить изображение"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <button @click="saveAnswer(task)" class="submit-button">Сохранить ответ</button>
                        </div>
                      </div>
                      
                      <div v-if="task.saving" class="saving-status">Сохранение...</div>
                    </div>
                    
                    <!-- Отображаем ответы только после завершения работы -->
                    <div v-else-if="(isCompleted || task.userAnswer || (task.answerImages && task.answerImages.length > 0)) && showAnswers" class="answer-result">
                      <div class="answer-feedback" :class="getFeedbackClass(task)">
                        <div class="feedback-content">
                          <span v-if="task.isCorrect" class="correct-icon">✓</span>
                          <span v-else-if="task.isPartiallyCorrect" class="partial-icon">±</span>
                          <span v-else class="incorrect-icon">✗</span>
                          
                          <div v-if="task.userAnswer" class="user-answer-container">
                            <strong>Ответ студента:</strong> 
                            <div class="user-answer-text" :class="{ 'multiline': isSecondPartTask(task) }">
                              <pre v-if="isSecondPartTask(task)" style="white-space: pre-wrap; font-family: inherit; margin: 0.5rem 0;">{{ task.userAnswer }}</pre>
                              <span v-else>{{ task.userAnswer }}</span>
                            </div>
                          </div>
                          
                          <!-- Изображения ответа -->
                          <div v-if="task.answerImages && task.answerImages.length > 0" class="answer-images">
                            <div class="images-title">Прикрепленные изображения:</div>
                            <div class="images-grid">
                              <div v-for="(imagePath, imgIndex) in task.answerImages" :key="imgIndex" class="image-item">
                                <img 
                                  :src="getAnswerImageUrl(imagePath)" 
                                  :alt="'Изображение ответа ' + (imgIndex + 1)"
                                  class="answer-image"
                                  @click="openImageModal(getAnswerImageUrl(imagePath))"
                                >
                                <button 
                                  v-if="!isCompleted && !isTutorMode"
                                  @click="removeAnswerImage(task, imgIndex)"
                                  class="remove-image-btn"
                                  title="Удалить изображение"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>

                          <span class="correct-answer-text">
                            <strong>Правильный ответ:</strong> 
                            <span v-html="sanitizeHtml(formatAnswerText(task.answer))"></span>
                          </span>
                          
                          <!-- Панель оценки куратора для заданий второй части -->
                          <div v-if="isTutorMode" class="tutor-scoring-panel">
                            <span class="score-label">Оценка куратора:</span>
                            <select 
                              v-model="task.manualScore" 
                              @change="setTutorScore(task, parseInt($event.target.value))"
                              class="score-select"
                              :disabled="task.saving"
                            >
                              <option v-for="n in task.points + 1" :value="n - 1" :key="n">
                                {{ n - 1 }} баллов
                              </option>
                            </select>
                            <span v-if="task.saving" class="saving-status">Сохранение...</span>
                          </div>
                          
                          <span class="current-score" v-if="task.awardedPoints !== null">
                            Набрано баллов: {{ task.awardedPoints }}/{{ task.points }}
                          </span>
                          
                          <!-- Кнопка редактирования (только если не завершено) -->
                          <button 
                            v-if="!isCompleted && !isTutorMode" 
                            @click="startEdit(task)" 
                            class="edit-answer-btn"
                            title="Редактировать ответ"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Ответ сохранен, но домашнее задание не завершено -->
                    <div v-else-if="(task.userAnswer || (task.answerImages && task.answerImages.length > 0) || task.answerSaved) && !showAnswers" class="answer-saved">
                      <span class="saved-icon">✓</span> Ответ сохранен
                      
                      <!-- Текстовый ответ -->
                      <div v-if="task.userAnswer" class="user-answer-container">
                        <div class="user-answer-text" :class="{ 'multiline': isSecondPartTask(task) }">
                          <pre v-if="isSecondPartTask(task)" style="white-space: pre-wrap; font-family: inherit; margin: 0.5rem 0;">{{ task.userAnswer }}</pre>
                          <span v-else>{{ task.userAnswer }}</span>
                        </div>
                      </div>
                      
                      <!-- Изображения ответа -->
                      <div v-if="task.answerImages && task.answerImages.length > 0" class="answer-images">
                        <div class="images-title">Прикрепленные изображения:</div>
                        <div class="images-grid">
                          <div v-for="(imagePath, imgIndex) in task.answerImages" :key="imgIndex" class="image-item">
                            <img 
                              :src="getAnswerImageUrl(imagePath)" 
                              :alt="'Изображение ответа ' + (imgIndex + 1)"
                              class="answer-image"
                              @click="openImageModal(getAnswerImageUrl(imagePath))"
                            >
                            <button 
                              @click="removeAnswerImage(task, imgIndex)"
                              class="remove-image-btn"
                              title="Удалить изображение"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        @click="startEdit(task)" 
                        class="edit-answer-btn"
                        title="Редактировать ответ"
                      >
                        ✏️
                      </button>
                    </div>
                    
                  </div>
                </div>

                <!-- Пояснение к заданию -->
                <div v-if="showAnswers && (task.explanation || (task.image_explanation && task.image_explanation.length))" 
                     class="explanation-section">
                  <div class="explanation-header" @click="toggleExplanation(task)" style="cursor: pointer;">
                    <div class="explanation-title">
                      Пояснение: 
                      <span class="explanation-toggle">
                        {{ task.showExplanation ? '▲' : '▼' }}
                      </span>
                    </div>
                  </div>
                  
                  <transition name="slide">
                    <div v-if="task.showExplanation" class="explanation-content-container">
<div class="explanation-content">
  <div v-if="task.explanation" v-html="sanitizeHtml(formatTextWithParagraphs(task.explanation))"></div>
  
  <!-- Изображения пояснения -->
  <div v-if="task.image_explanation && Array.isArray(task.image_explanation)" 
       v-for="(imagePath, index) in task.image_explanation" :key="index">
    <div class="explanation-image-container">
      <img :src="getImageUrl(imagePath)" 
           alt="Пояснение к заданию" 
           class="explanation-image"
           @click="openImageModal(getImageUrl(imagePath))">
    </div>
  </div>
  
  <div v-else-if="typeof task.image_explanation === 'string'">
    <div class="explanation-image-container">
      <img :src="getImageUrl(task.image_explanation)" 
           alt="Пояснение к заданию" 
           class="explanation-image"
           @click="openImageModal(getImageUrl(task.image_explanation))">
    </div>
  </div>
</div>
                    </div>
                  </transition>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Блок итоговой оценки куратора -->
        <div v-if="isTutorMode" class="tutor-final-assessment">
          <h3>Итоговая оценка</h3>
          
          <div class="student-info">
            <div class="student-name">
              <strong>Ученик:</strong> {{ studentFullName }}
            </div>
          </div>
          
          <div class="final-score">
            Общий балл: {{ totalScore }}/{{ maxScore }}
            <div class="completion-percent">
              Выполнено на: {{ completionPercent }}%
            </div>
          </div>
          
          <div class="tutor-actions">
            <button @click="updateHomeworkCompletedOnly" class="save-final-score-btn">
              Сохранить итоговую оценку (без уведомления)
            </button>
          </div>
        </div>

        <!-- Кнопка завершения -->
        <div v-if="!isViewMode && !isCompleted && hasAnswers" class="completion-section">
          <button @click="completeHomework" class="complete-btn">
            Завершить домашнее задание
          </button>
        </div>

        <div v-if="isCompleted" class="completion-result">
          <h3>Домашнее задание завершено!</h3>
          <p>Набрано баллов: {{ totalScore }}/{{ maxScore }}</p>
          <p>Выполнено на: {{ completionPercent }}%</p>
        </div>

      </div>
    </div>

    <!-- Модальное окно для изображений -->
    <div v-if="showImageModal" class="image-modal" @click.self="closeImageModal">
      <div class="modal-content">
        <img :src="selectedImage" class="modal-image">
        <button class="close-modal" @click="closeImageModal">×</button>
      </div>
    </div>
  </div>
</template>


<style scoped>
/* Все оригинальные стили остаются без изменений */
.homework-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: clamp(1rem, 3vw, 2rem);
}

.homework-header {
  margin-bottom: clamp(1.5rem, 4vw, 2rem);
  text-align: center;
}

.homework-header h1 {
  color: #333;
  font-size: clamp(1.8rem, 5vw, 2.5rem);
  margin-bottom: clamp(0.5rem, 2vw, 1rem);
  line-height: 1.2;
}

.homework-meta {
  display: flex;
  justify-content: center;
  gap: clamp(1rem, 3vw, 1.5rem);
  flex-wrap: wrap;
  align-items: center;
}

.lesson-info {
  color: #666;
  font-size: clamp(0.9rem, 2.5vw, 1.1rem);
}

.deadline {
  padding: 0.4rem 0.8rem;
  border-radius: 1rem;
  font-weight: 500;
  font-size: clamp(0.8rem, 2vw, 0.95rem);
}

.deadline.overdue {
  background-color: #ffebee;
  color: #d32f2f;
}

.deadline.today {
  background-color: #fff3e0;
  color: #f57c00;
}

.deadline.future {
  background-color: #e8f5e8;
  color: #388e3c;
}

.deadline.no-deadline {
  background-color: #f5f5f5;
  color: #757575;
}

.tasks-container {
  margin-bottom: clamp(1.5rem, 4vw, 2rem);
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: clamp(1rem, 3vw, 1.5rem);
}

.task-item {
  border: 1px solid #e0e0e0;
  border-radius: 0.8rem;
  padding: clamp(1rem, 3vw, 1.5rem);
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  width: 100%;
}

.task-header {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-bottom: 1rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #eee;
}

@media (min-width: 768px) {
  .task-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
  }
}

.task-meta {
  flex: 1;
  min-width: 0;
}

.task-topic {
  font-weight: 500;
  color: #333;
  font-size: clamp(1rem, 2.5vw, 1.2rem);
  display: block;
  line-height: 1.4;
  word-wrap: break-word;
}

.task-id {
  color: #888;
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  font-weight: bold;
  display: block;
  margin-top: 0.4rem;
}

.task-part-badge {
  background: #b241d1;
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 0.3rem;
  font-size: 0.75rem;
  font-weight: bold;
  margin-left: 0.5rem;
}

.task-status {
  padding: 0.4rem 0.8rem;
  border-radius: 0.4rem;
  font-size: clamp(0.75rem, 2vw, 0.85rem);
  font-weight: bold;
  align-self: flex-start;
}
.completion-section {
  margin-top: 2rem;
  text-align: center;
  padding: 1.5rem;
  border-top: 2px solid #eee;
  width: 100%;
}

.complete-btn {
  padding: 1rem 2rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 0.6rem;
  font-size: clamp(1rem, 2.5vw, 1.1rem);
  cursor: pointer;
  transition: background-color 0.3s ease;
  min-width: min(100%, 300px);
}

.complete-btn:hover {
  background-color: #218838;
}
.status-not-completed {
  background: #f5f5f5;
  color: #666;
}

.status-correct {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-partial {
  background: #fff3e0;
  color: #ff8f00;
}

.status-incorrect {
  background: #ffebee;
  color: #c62828;
}

.task-content {
  margin-bottom: 1.2rem;
}

.task-text {
  line-height: 1.6;
  color: #333;
  margin-bottom: 1.2rem;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  width: 100%;
}

.task-text :deep(sub),
.task-text :deep(sup) {
  font-size: 0.75em;
  line-height: 1;
  position: relative;
  vertical-align: baseline;
}

.task-text :deep(sub) {
  bottom: -0.25em;
}

.task-text :deep(sup) {
  top: -0.5em;
}

.task-text :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.task-text :deep(table td) {
  padding: 0.5rem;
  border: 1px solid #ddd;
  vertical-align: top;
}

.task-text :deep(strong) {
  font-weight: 600;
}

.task-text :deep(em) {
  font-style: italic;
}

.answer-feedback {
  padding: 0.75rem;
  border-radius: 0.4rem;
  font-weight: 500;
  margin-top: 0.9rem;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.correct-feedback {
  background-color: #e8f5e9;
  color: #2e7d32;
  border-left: 4px solid #2e7d32;
}

.partial-feedback {
  background-color: #fff3e0;
  color: #ff8f00;
  border-left: 4px solid #ff8f00;
}

.incorrect-feedback {
  background-color: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
}

.feedback-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.correct-icon, .partial-icon, .incorrect-icon {
  font-size: 1.2rem;
}

.correct-icon {
  color: #2e7d32;
}

.partial-icon {
  color: #ff8f00;
}

.incorrect-icon {
  color: #c62828;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.feedback-content strong {
  font-weight: 600;
}

.correct-feedback .feedback-content strong {
  color: #1b5e20;
}

.partial-feedback .feedback-content strong {
  color: #e65100;
}

.incorrect-feedback .feedback-content strong {
  color: #b71c1c;
}

.task-table-container {
  font-family: Evolventa !important;
  margin: 1.2rem 0;
  overflow-x: auto;
  width: 100%;
}

.task-table-container table {
    font-family: Evolventa !important;
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.2rem;
  min-width: 300px;
}

.task-table-container table.with-borders {
  font-family: Evolventa !important;
  border: 1px solid #ddd;
}

.task-table-container table.with-borders td {
  font-family: Evolventa !important;
  border: 1px solid #ddd;
  padding: 0.6rem;
}

.task-table-container td {
  font-family: Evolventa !important;
  padding: 0.6rem;
  vertical-align: top;
  font-size: clamp(0.9rem, 2vw, 1rem);
}

.task-table-container :deep(sub),
.task-table-container :deep(sup) {
  font-family: Evolventa !important;
  font-size: 0.75em;
  line-height: 1;
  position: relative;
  vertical-align: baseline;
}

.task-table-container :deep(sub) {
  font-family: Evolventa !important;
  bottom: -0.25em;
}

.task-table-container :deep(sup) {
  font-family: Evolventa !important;
  top: -0.5em;
}

.task-table-container :deep(p) {
  font-family: Evolventa !important;
  margin: 0;
  padding: 0;
}

.task-table-container :deep(strong) {
  font-family: Evolventa !important;
  font-weight: 600;
}

.task-table-container :deep(em) {
  font-family: Evolventa !important;
  font-style: italic;
}

.task-images {
  margin-bottom: 1.25rem;
  width: 100%;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.8rem;
  margin-top: 0.8rem;
}

.image-container {
  position: relative;
  padding-top: 100%;
  overflow: hidden;
  border-radius: 0.4rem;
  border: 1px solid #eee;
  background: #f8f9fa;
  cursor: pointer;
}

.task-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}
.upload-status {
  padding: 0.5rem;
  border-radius: 0.3rem;
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.upload-status-uploading {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.upload-status-success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.save-images-btn {
  margin-top: 1rem;
  padding: 0.6rem 1rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 0.3rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.save-images-btn:hover {
  background-color: #218838;
}
.task-image:hover {
  transform: scale(1.03);
}

.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.modal-content {
  position: relative;
  max-width: 95%;
  max-height: 95%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-image {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 0.4rem;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.6);
}

.close-modal {
  position: absolute;
  top: -1.5rem;
  right: -1.5rem;
  background: #b241d1;
  color: white;
  border: none;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  z-index: 10001;
}

.close-modal:hover {
  background: #9a36b8;
}

@media (max-width: 768px) {
  .close-modal {
    top: -1rem;
    right: -1rem;
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.2rem;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}

.task-image:hover {
  transform: scale(1.05);
}

.answer-section {
  margin-top: 1.2rem;
  width: 100%;
}

.answer-input-container {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
  width: 100%;
}

@media (min-width: 480px) {
  .answer-input-container {
    flex-direction: row;
    align-items: center;
  }
}

.answer-input {
  flex: 1;
  padding: 0.8rem 1rem;
  border: 1px solid #ddd;
  border-radius: 0.4rem;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  min-width: 0;
  width: 100%;
}

.answer-input:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.2);
}

/* Стили для текстовой области */
.answer-textarea {
  flex: 1;
  padding: 0.8rem 1rem;
  border: 1px solid #ddd;
  border-radius: 0.4rem;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  min-width: 0;
  width: 100%;
  min-height: 80px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.4;
}

.answer-textarea:focus {
  outline: none;
  border-color: #b241d1;
  box-shadow: 0 0 0 2px rgba(178, 65, 209, 0.2);
}

.answer-textarea.extended {
  min-height: 120px;
  font-size: 1rem;
  line-height: 1.5;
}

.submit-button {
  padding: 0.8rem 1.2rem;
  background-color: #b241d1;
  color: white;
  border: none;
  border-radius: 0.4rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  min-width: fit-content;
  white-space: nowrap;
}

.submit-button:hover {
  background-color: #9a36b8;
}

.answer-feedback {
  padding: 1rem;
  border-radius: 0.4rem;
  font-weight: 500;
  margin-top: 0.8rem;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  width: 100%;
}

.correct-feedback {
  background-color: #e8f5e9;
  color: #2e7d32;
  border-left: 4px solid #2e7d32;
}

.partial-feedback {
  background-color: #fff3e0;
  color: #ff8f00;
  border-left: 4px solid #ff8f00;
}

.incorrect-feedback {
  background-color: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.feedback-content strong {
  font-weight: 600;
}

.correct-feedback .feedback-content strong {
  color: #1b5e20;
}

.partial-feedback .feedback-content strong {
  color: #e65100;
}

.incorrect-feedback .feedback-content strong {
  color: #b71c1c;
}

.task-table-container {
  margin: 1.2rem 0;
  overflow-x: auto;
  width: 100%;
}
.completion-result {
  margin-top: 2rem;
  padding: 1.5rem;
  background-color: #e8f5e9;
  border-radius: 0.6rem;
  text-align: center;
  border-left: 4px solid #28a745;
  width: 100%;
}

.completion-result h3 {
  color: #2e7d32;
  margin-bottom: 0.8rem;
  font-size: clamp(1.2rem, 3vw, 1.5rem);
}

.completion-result p {
  color: #388e3c;
  font-size: clamp(1rem, 2.5vw, 1.1rem);
  font-weight: 500;
}
.task-table-container table {
  font-family: Evolventa !important;
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.2rem;
  min-width: 300px;
}

.task-table-container table.with-borders {
  font-family: Evolventa !important;
  border: 1px solid #ddd;
}

.task-table-container table.with-borders td {
  font-family: Evolventa !important;
  border: 1px solid #ddd;
  padding: 0.6rem;
}

.task-table-container td {
  font-family: Evolventa !important;
  padding: 0.6rem;
  vertical-align: top;
  font-size: clamp(0.9rem, 2vw, 1rem);
}

.task-table-container :deep(sub),
.task-table-container :deep(sup) {
  font-family: Evolventa !important;
  font-size: 0.75em;
  line-height: 1;
  position: relative;
  vertical-align: baseline;
}

.task-table-container :deep(sub) {
  font-family: Evolventa !important;
  bottom: -0.25em;
}

.task-table-container :deep(sup) {
  font-family: Evolventa !important;
  top: -0.5em;
}

.task-table-container :deep(p) {
  font-family: Evolventa !important;
  margin: 0;
  padding: 0;
}

.task-table-container :deep(strong) {
  font-family: Evolventa !important;
  font-weight: 600;
}

.task-table-container :deep(em) {
  font-family: Evolventa !important;
  font-style: italic;
}

.task-images {
  margin-bottom: 1.25rem;
  width: 100%;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.8rem;
  margin-top: 0.8rem;
}

.image-container {
  position: relative;
  padding-top: 100%;
  overflow: hidden;
  border-radius: 0.4rem;
  border: 1px solid #eee;
  background: #f8f9fa;
  cursor: pointer;
}

.task-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}
.completion-section {
  margin-top: 2rem;
  text-align: center;
  padding: 1.5rem;
  border-top: 2px solid #eee;
  width: 100%;
}

.complete-btn {
  padding: 1rem 2rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 0.6rem;
  font-size: clamp(1rem, 2.5vw, 1.1rem);
  cursor: pointer;
  transition: background-color 0.3s ease;
  min-width: min(100%, 300px);
}

.complete-btn:hover {
  background-color: #218838;
}
.task-image:hover {
  transform: scale(1.03);
}

.image-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.modal-content {
  position: relative;
  max-width: 95%;
  max-height: 95%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-image {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 0.4rem;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.6);
}

.close-modal {
  position: absolute;
  top: -1.5rem;
  right: -1.5rem;
  background: #b241d1;
  color: white;
  border: none;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  z-index: 10001;
}

.close-modal:hover {
  background: #9a36b8;
}

@media (max-width: 768px) {
  .close-modal {
    top: -1rem;
    right: -1rem;
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.2rem;
  }
  
  .task-header {
    gap: 0.6rem;
  }
  
  .answer-input-container {
    gap: 0.6rem;
  }
}

.tutor-mode-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.4rem;
  margin: 0.5rem 0;
  font-weight: bold;
  text-align: center;
}

.extended-task {
  border-left: 4px solid #b241d1;
  background-color: white;
}

.tutor-scoring-panel {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-top: 0.8rem;
  padding: 0.8rem;
  background-color: rgba(102, 126, 234, 0.1);
  border-radius: 0.4rem;
  flex-wrap: wrap;
}

.score-label {
  font-weight: 600;
  color: #667eea;
}

.score-select {
  padding: 0.4rem 0.8rem;
  border: 1px solid #667eea;
  border-radius: 0.3rem;
  background: white;
  color: #333;
}

.score-select:focus {
  outline: none;
  border-color: #5a67d8;
  box-shadow: 0 0 0 2px rgba(90, 103, 216, 0.2);
}

.current-score {
  font-weight: 600;
  color: #4a5568;
  margin-left: auto;
}

.tutor-final-assessment {
  margin-top: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border-radius: 0.8rem;
  text-align: center;
}

.tutor-final-assessment h3 {
  margin-bottom: 1rem;
  font-size: 1.3rem;
}

.tutor-final-assessment .student-info {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 0.6rem;
  padding: 1rem;
  margin-bottom: 1rem;
  text-align: center;
  color: #333;
}

.tutor-final-assessment .student-info .student-name {
  font-size: 1.2rem;
  font-weight: 500;
}

.tutor-final-assessment .student-info strong {
  color: #667eea;
  margin-right: 0.5rem;
}

.final-score {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 1rem 0;
  color: white;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
}

.completion-percent {
  font-size: 1.1rem;
  opacity: 0.9;
  margin-top: 0.5rem;
}

.tutor-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.save-final-score-btn {
  padding: 0.8rem 1.5rem;
  background: white;
  color: #f5576c;
  border: none;
  border-radius: 0.4rem;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s;
}

.save-final-score-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .tutor-scoring-panel {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .current-score {
    margin-left: 0;
    margin-top: 0.5rem;
  }
  
  .score-select {
    width: 100%;
  }
  
  .tutor-actions {
    flex-direction: column;
  }
  
  .tutor-final-assessment {
    padding: 1rem;
  }
  
  .tutor-final-assessment .student-info {
    padding: 0.8rem;
    font-size: 0.9rem;
  }
}

.extended-task .task-header {
  background-color: rgba(178, 65, 209, 0.05);
  padding: 1rem;
  margin: -1rem -1rem 1rem -1rem;
  border-radius: 0.8rem 0.8rem 0 0;
}

.extended-task .task-id {
  color: #b241d1;
  font-weight: bold;
}

/* Новые стили для загрузки изображений */
.image-upload-section {
  margin: 1rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 0.4rem;
  border: 1px dashed #dee2e6;
}

.upload-label {
  display: inline-block;
  background: #b241d1;
  color: white;
  padding: 0.8rem 1.2rem;
  border-radius: 0.4rem;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 1rem;
}

.upload-label:hover {
  background: #9a36b8;
}

.file-input {
  display: none;
}

.uploading-text {
  color: #6c757d;
  font-style: italic;
  margin-top: 0.5rem;
}

.answer-images-preview {
  margin-top: 1rem;
}

.images-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.8rem;
  font-size: 0.9rem;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.image-item {
  position: relative;
  display: inline-block;
}

.answer-image {
  width: 100%;
  height: 80px;
  object-fit: cover;
  border-radius: 0.4rem;
  border: 1px solid #dee2e6;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.answer-image:hover {
  transform: scale(1.05);
}

.remove-image-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-image-btn:hover {
  background: #c82333;
}

.answer-saved {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  padding: 1rem;
  background-color: #e8f5e9;
  border-radius: 0.4rem;
  border-left: 4px solid #28a745;
  flex-direction: column;
  transition: all 0.3s ease;
}

.answer-saved.fade-out {
  opacity: 0.7;
  background-color: #f8f9fa;
}

.user-answer-container {
  width: 100%;
}

.user-answer-text {
  margin-left: 0.5rem;
  color: #155724;
}

.user-answer-text.multiline {
  white-space: pre-wrap;
  word-wrap: break-word;
  background: #f8f9fa;
  padding: 0.8rem;
  border-radius: 0.4rem;
  border-left: 3px solid #b241d1;
  margin: 0.5rem 0;
  line-height: 1.5;
  font-family: inherit;
}

.edit-answer-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 0.3rem;
  font-size: 1.1rem;
  transition: background-color 0.2s;
  margin-left: auto;
}

.edit-answer-btn:hover {
  background-color: rgba(178, 65, 209, 0.1);
}

.cancel-button {
  padding: 0.8rem 1.2rem;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 0.4rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  min-width: fit-content;
  white-space: nowrap;
}

.cancel-button:hover {
  background-color: #5a6268;
}

.saving-status {
  color: #6c757d;
  font-style: italic;
  margin-top: 0.5rem;
}

/* Стили для пояснения (взяты из TaskCard) */
.explanation-section {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  border-left: 4px solid #b241d1;
}

.explanation-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.explanation-title {
  font-weight: 600;
  color: #333;
  font-size: 1.1rem;
}

.explanation-toggle {
  font-size: 0.8rem;
  color: #b241d1;
}

.explanation-content-container {
  margin-top: 0.5rem;
}

.explanation-content {
  line-height: 1.6;
  color: #444;
}

.explanation-content :deep(p) {
  margin-bottom: 0.8rem;
}

.explanation-content :deep(p:last-child) {
  margin-bottom: 0;
}

.explanation-content :deep(br) {
  content: "";
  display: block;
  margin-bottom: 0.4rem;
}

.explanation-content :deep(ul),
.explanation-content :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.explanation-content :deep(li) {
  margin-bottom: 0.3rem;
}

.explanation-image-container {
  margin: 1rem 0;
  text-align: center;
}

.explanation-image {
  max-width: 100%;
  height: auto;
  max-height: 300px;
  border-radius: 0.4rem;
  border: 1px solid #ddd;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.explanation-image:hover {
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}

/* Адаптивность */
@media (max-width: 768px) {
  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  }
  
  .answer-image {
    height: 60px;
  }
  
  .answer-saved {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .edit-answer-btn {
    margin-left: 0;
    margin-top: 0.5rem;
  }
  
  .answer-input-container {
    flex-direction: column;
  }
  
  .answer-textarea {
    min-height: 80px;
  }
  
  .answer-textarea.extended {
    min-height: 100px;
  }
}

@media (max-width: 480px) {
  .answer-textarea {
    min-height: 60px;
  }
  
  .answer-textarea.extended {
    min-height: 80px;
  }
}
</style>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa"), url("/src/assets/evolventa/Evolventa-Regular.woff");
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa Oblique"), url("/src/assets/evolventa/Evolventa-Oblique.woff");
  font-weight: normal;
  font-style: italic;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa Bold"), url("/src/assets/evolventa/Evolventa-Bold.woff");
  font-weight: bold;
  font-style: normal;
}

@font-face {
  font-family: Evolventa;
  src: local("Evolventa Bold Oblique"), url("/src/assets/evolventa/Evolventa-BoldOblique.woff");
  font-weight: bold;
  font-style: italic;
}

* {
  font-family: Evolventa, -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  background: white;
  width: 100%;
  min-height: 100vh;
  line-height: 1.4;
}

a {
  color: white;
  text-decoration: none;
}

.allpage {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.topmenu {
  width: 100%;
  padding: clamp(0.8rem, 2vw, 1rem) clamp(1rem, 5%, 2rem);
  color: white;
  font-size: clamp(1rem, 2vw, 1.4rem);
  background-image: url(./assets/background_line.png);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.logo {
  font-weight: bold;
  white-space: nowrap;
}

.rightparttopmenu {
  display: flex;
  gap: clamp(1rem, 3vw, 2rem);
  align-items: center;
  flex-wrap: wrap;
  font-size: clamp(0.9rem, 1.8vw, 1.1rem);
}

.redirect_menu, .go_back {
  padding: 0.5rem 1rem;
  border-radius: 0.4rem;
  transition: background-color 0.2s;
  cursor: pointer;
}

.redirect_menu:hover, .go_back:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.centerpartpage {
  flex: 1;
  width: 100%;
  padding: clamp(1rem, 3vw, 2rem);
  display: flex;
  justify-content: center;
}

.mainpart {
  width: 100%;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: clamp(1rem, 3vw, 2rem);
}

table {
  font-family: Evolventa !important;
}

td, th {
  font-family: Evolventa !important;
}

/* Для всех элементов внутри таблиц */
table * {
  font-family: Evolventa !important;
}

@media (max-width: 768px) {
  .topmenu {
    flex-direction: column;
    text-align: center;
    gap: 0.8rem;
  }
  
  .rightparttopmenu {
    justify-content: center;
  }
  
  .homework-content {
    padding: 1rem;
  }
  
  .task-item {
    padding: 1rem;
    margin: 0 -0.5rem;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
}

@media (max-width: 480px) {
  .homework-header h1 {
    font-size: 1.5rem;
  }
  
  .homework-meta {
    flex-direction: column;
    gap: 0.8rem;
  }
  
  .task-status {
    align-self: stretch;
    text-align: center;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  }
}
.task-text {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: default;
}

.task-text ::selection {
  background: transparent;
}

.task-text ::-moz-selection {
  background: transparent;
}

/* Дополнительная защита через псевдо-элемент */
.task-text {
  position: relative;
}

.task-text::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
}
</style>
