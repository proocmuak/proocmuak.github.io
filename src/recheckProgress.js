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

// === вспомогательные функции для проверки ===
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

function freqMap(arr) {
  const m = new Map()
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1)
  return m
}

function normalizeText(s) {
  return s.toLowerCase().replace(/\s+/g, '')
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
      const userElems = splitNumericElements(userRaw)
      const correctElems = splitNumericElements(variant)

      if (orderMatters) {
        let matches = 0
        for (let i = 0; i < correctElems.length; i++) {
          if (userElems[i] === correctElems[i]) matches++
        }
        const mistakes = correctElems.length - matches
        if (mistakes === 0) {
          anyCorrect = true
          break
        }
        if (points === 2 && mistakes === 1) anyPartial = true
      } else {
        let matches = 0;
        if (points === 1 && correctElems.length === userElems.length) {
            for (let i = 0; i < correctElems.length; i++) {
                if (userElems[i] === correctElems[i]) matches++
            }
            const mistakes = correctElems.length - matches
            if (mistakes === 0) {
                anyCorrect = true
                break
            }
        }

if (points === 2) {
    // Считаем количество совпадающих элементов (без учета порядка)
    let matches = 0;
    for (let i = 0; i < userElems.length; i++) {
        if (correctElems.includes(userElems[i])) {
            matches++;
        }
    }
    
    // Преобразуем оба массива в числа для сравнения
    const numCorrect = correctElems.map(Number);
    const numUser = userElems.map(Number);
    
    // Сортируем и сравниваем
    const sortedCorrect = [...numCorrect].sort();
    const sortedUser = [...numUser].sort();
    
    if (sortedCorrect.join(',') === sortedUser.join(',')) {
        anyCorrect = true;
    }
    if (
               ((matches === userElems.length || matches === correctElems.length) &&
               Math.abs(correctElems.length - userElems.length) === 1) || 
              (Math.abs(matches-correctElems.length) === 1)
            ) {
        // Частичное совпадение: либо все элементы одного массива есть в другом,
        // либо разница в длине всего 1 элемент
        anyPartial = true;
    }
    
    break;
}
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

// === основная функция ===
async function recheckSubjectProgress(subject, supabase) {
  const progressTable = `${subject}_progress`
  const taskBank = `${subject}_task_bank`
  const shortSubject = shortSubjectFromProgressTable(progressTable)

  console.log(`\n=== Перепроверка ${subject} ===`)

  const { data: progresses, error: progError } = await supabase
    .from(progressTable)
    .select('id, user_id, task_id, is_completed, score, user_answer')

  if (progError) {
    console.error(`Ошибка выборки из ${progressTable}:`, progError)
    return
  }

  for (const prog of progresses) {
    const { data: taskRows, error: taskError } = await supabase
      .from(taskBank)
      .select('id, answer, points, number')
      .eq('id', prog.task_id)
      .maybeSingle()

    if (taskError || !taskRows) continue
    const task = taskRows

    const result = checkAnswer(
      prog.user_answer,
      task.answer,
      task.points,
      shortSubject,
      task.number,
      prog.task_id
    )

    if (result.score !== prog.score || result.isCorrect !== prog.is_completed) {
      console.log(
        `LOG: user_id=${prog.user_id}, task_id=${prog.task_id}, number=${task.number}, старый=${prog.score} → новый=${result.score}`
      )
      console.log(`       user_answer="${prog.user_answer}", correct_answer="${task.answer}"`)

      const { error: updateError } = await supabase
        .from(progressTable)
        .update({
          score: result.score,
          is_completed: result.isCorrect,
          last_updated: new Date().toISOString()
        })
        .eq('id', prog.id)

      if (updateError) {
        console.error('Ошибка обновления:', updateError)
      }
    }
  }

  console.log(`\n✅ Перепроверка ${subject} завершена`)
}

// === запуск ===
const subjects = ['biology_ege']

for (const subj of subjects) {
  await recheckSubjectProgress(subj, supabase)
}
