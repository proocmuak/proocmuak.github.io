import { supabase } from './supabase.js'

// === список заданий с учётом порядка ===
const ORDERED_TASKS = {
  chemistry: [6, 7, 8, 14, 15, 22, 23, 24],
  biology: [2, 6, 8, 10, 12, 14, 16, 19, 20]
}

// === нормализация номера ===
function normalizeTaskNumber(taskNumber) {
  if (taskNumber == null) return null
  const s = String(taskNumber).trim()
  const m = s.match(/\d+/)
  if (!m) return null
  const n = parseInt(m[0], 10)
  return Number.isNaN(n) ? null : n
}

// === короткий subject из названия таблицы ===
function shortSubjectFromProgressTable(progressTableName) {
  const s = String(progressTableName).toLowerCase()
  if (s.includes('chemistry')) return 'chemistry'
  if (s.includes('biology')) return 'biology'
  return null
}

// === вспомогательные функции ===
function splitAnswerVariantsRaw(raw) {
  if (!raw) return []
  return String(raw)
    .split(/[/]|ИЛИ/i)
    .map(s => s.trim())
    .filter(Boolean)
}

function isDigitSequence(s) {
  return /^[0-9]+$/.test(s)
}

function splitNumericElements(s) {
  return s.split('').filter(ch => /\d/.test(ch))
}

function normalizeText(s) {
  return s.toLowerCase().replace(/\s+/g, '')
}

// === проверка числовых ответов ===
function checkNumericAnswer(userRaw, variant, points, orderMatters) {
  const userElems = splitNumericElements(userRaw)
  const correctElems = splitNumericElements(variant)

  if (orderMatters) {
    // порядок обязателен
    let matches = 0
    for (let i = 0; i < correctElems.length; i++) {
      if (userElems[i] === correctElems[i]) matches++
    }
    const mistakes = correctElems.length - matches
    if (mistakes === 0) {
      return { correct: true, partial: false }
    }
    if (points === 2 && mistakes === 1) {
      return { correct: false, partial: true }
    }
  } else {
    if (points === 1 && correctElems.length === userElems.length) {
      let matches = 0
      for (let i = 0; i < correctElems.length; i++) {
        if (userElems[i] === correctElems[i]) matches++
      }
      if (matches === correctElems.length) {
        return { correct: true, partial: false }
      }
    }

    if (points === 2) {
      // порядок НЕ важен
      const sortedCorrect = [...correctElems].sort()
      const sortedUser = [...userElems].sort()

      if (JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)) {
        return { correct: true, partial: false }
      }

      // частичное совпадение
      const matches = userElems.filter(e => correctElems.includes(e)).length
      if (
        ((matches === userElems.length || matches === correctElems.length) &&
          Math.abs(correctElems.length - userElems.length) === 1) ||
        Math.abs(matches - correctElems.length) === 1
      ) {
        return { correct: false, partial: true }
      }
    }
  }

  return { correct: false, partial: false }
}

// === проверка ответа ===
function checkAnswer(userAnswerRaw, correctAnswerRaw, points, shortSubject, taskNumberRaw, taskId = null) {
  const userRaw = userAnswerRaw == null ? '' : String(userAnswerRaw).trim()
  if (!userRaw) {
    return { score: 0, isCorrect: false, isPartiallyCorrect: false }
  }

  const variants = splitAnswerVariantsRaw(correctAnswerRaw)
  let anyCorrect = false
  let anyPartial = false

  const taskNum = normalizeTaskNumber(taskNumberRaw)
  let orderMatters = false
  if (points === 2 && shortSubject && taskNum != null) {
    orderMatters = ORDERED_TASKS[shortSubject]?.includes(taskNum) || false
  }

  for (const variant of variants) {
    if (isDigitSequence(variant) && isDigitSequence(userRaw)) {
      const { correct, partial } = checkNumericAnswer(userRaw, variant, points, orderMatters)
      if (correct) {
        anyCorrect = true
        break
      }
      if (partial) {
        anyPartial = true
      }
    } else {
      if (normalizeText(userRaw) === normalizeText(variant)) {
        anyCorrect = true
        break
      }
    }
  }

  const isCorrect = anyCorrect
  const isPartiallyCorrect = !isCorrect && anyPartial
  const score = isCorrect ? points : isPartiallyCorrect ? 1 : 0

  return { score, isCorrect, isPartiallyCorrect }
}

// === утилита: выборка всех строк с пагинацией ===
async function getAllProgressRows(progressTable) {
  let allRows = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from(progressTable)
      .select('id, user_id, task_id, is_completed, score, user_answer, counted_in_raiting')
      .range(from, from + pageSize - 1)

    if (error) {
      console.error(`Ошибка выборки из ${progressTable}:`, error)
      break
    }

    if (!data || data.length === 0) break

    allRows = allRows.concat(data)
    from += pageSize
  }

  return allRows
}

// === основная функция перепроверки ===
async function recheckSubjectProgress(subject, supabase) {
  const progressTable = `${subject}_progress`
  const taskBank = `${subject}_task_bank`
  const shortSubject = shortSubjectFromProgressTable(progressTable)

  console.log(`\n=== Перепроверка ${subject} (только первая часть) ===`)

  const progresses = await getAllProgressRows(progressTable)
  console.log(`Всего найдено ${progresses.length} записей в ${progressTable}`)

  let updatedCount = 0
  let unchangedCount = 0
  let skippedCount = 0

  for (const prog of progresses) {
    // Получаем информацию о задании с фильтром по части
    const { data: taskRows, error: taskError } = await supabase
      .from(taskBank)
      .select('id, answer, points, number, part')
      .eq('id', prog.task_id)
      .eq('part', 'Первая часть') // ФИЛЬТР: только первая часть
      .maybeSingle()

    if (taskError || !taskRows) {
      skippedCount++
      continue // Пропускаем задания не из первой части или с ошибками
    }
    
    const task = taskRows

    const result = checkAnswer(
      prog.user_answer,
      task.answer,
      task.points,
      shortSubject,
      task.number,
      prog.task_id
    )

    // Определяем, нужно ли обновлять counted_in_raiting
    const newCountedInRaiting = result.isCorrect // true только если задание полностью решено верно

    // Проверяем, нужно ли обновлять запись
    const needsUpdate = 
      result.score !== prog.score || 
      result.isCorrect !== prog.is_completed ||
      newCountedInRaiting !== prog.counted_in_raiting

    if (needsUpdate) {
      updatedCount++
      console.log(
        `UPDATE: user_id=${prog.user_id}, task_id=${prog.task_id}, number=${task.number}, ` +
        `старый=${prog.score}/${prog.is_completed}/${prog.counted_in_raiting} → новый=${result.score}/${result.isCorrect}/${newCountedInRaiting}`
      )
      console.log(`   user_answer="${prog.user_answer}", correct_answer="${task.answer}"`)

      const { data: updated, error: updateError } = await supabase
        .from(progressTable)
        .update({
          score: result.score,
          is_completed: result.isCorrect,
          counted_in_raiting: newCountedInRaiting, // ОБНОВЛЕНО: выставляем true только для полностью верных решений
          last_updated: new Date().toISOString()
        })
        .eq('id', prog.id)
        .select('*')

      if (updateError) {
        console.error('Ошибка обновления:', updateError)
      } else {
        console.log('DEBUG Обновлено:', updated)
      }
    } else {
      unchangedCount++
    }
  }

  console.log(`\n✅ Перепроверка ${subject} завершена.`)
  console.log(`📊 Статистика:`)
  console.log(`   - Изменено: ${updatedCount}`)
  console.log(`   - Без изменений: ${unchangedCount}`)
  console.log(`   - Пропущено (не первая часть): ${skippedCount}`)
}

// === запуск ===
const subjects = ['biology_ege', 'chemistry_ege'] // можно расширить список предметов
for (const subj of subjects) {
  await recheckSubjectProgress(subj, supabase)
}