// recheckProgress.js
import 'dotenv/config';
import {supabase} from './supabase.js'

// ========== УТИЛИТЫ проверки ответов ==========

function isDigitSequence(s) {
  if (s == null) return false;
  return typeof s === 'string' && /^[0-9\s,;]+$/.test(s.trim());
}

function splitNumericElements(s) {
  s = String(s || '').trim();
  if (!s) return [];
  if (/[^0-9]/.test(s)) {
    const tokens = s.split(/[^0-9]+/).filter(Boolean);
    if (tokens.length > 0) return tokens;
  }
  return s.split('');
}

function freqMap(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return m;
}

function checkPartialMatch(userAnswer, correctAnswer, maxPoints = 2, options = { allowExtra: false }) {
  if (userAnswer == null || correctAnswer == null) return false;
  if (!isDigitSequence(String(userAnswer)) || !isDigitSequence(String(correctAnswer))) return false;

  const correctElems = splitNumericElements(correctAnswer);
  const userElems = splitNumericElements(userAnswer);

  if (!options.allowExtra && userElems.length > correctElems.length) return false;

  const fc = freqMap(correctElems);
  const fu = freqMap(userElems);

  let matched = 0;
  for (const [k, cnt] of fc.entries()) {
    if (fu.has(k)) matched += Math.min(cnt, fu.get(k));
  }

  const mistakes = correctElems.length - matched;
  if (mistakes === 0) return true;
  if (maxPoints === 2 && mistakes === 1) return true;
  return false;
}

function normalizeText(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Возвращает массив вариантов (не нормализованных), разделённых "/" или "или" (в любом регистре)
function splitAnswerVariantsRaw(correctAnswerRaw) {
  if (correctAnswerRaw == null) return [];
  return String(correctAnswerRaw)
    .split(/\/|или/i)
    .map(s => s.trim())
    .filter(Boolean);
}

// Возвращает { score, isCorrect, isPartiallyCorrect }
function checkAnswer(userAnswerRaw, correctAnswerRaw, points) {
  const userRaw = userAnswerRaw == null ? "" : String(userAnswerRaw).trim();

  if (!userRaw) {
    return { score: 0, isCorrect: false, isPartiallyCorrect: false };
  }

  const variants = splitAnswerVariantsRaw(correctAnswerRaw);

  let anyCorrect = false;
  let anyPartial = false;

  for (const variant of variants) {
    // Если оба — цифровые последовательности, используем цифровую логику
    if (isDigitSequence(variant) && isDigitSequence(userRaw)) {
      // нормализованные строки для строгого сравнения
      const normV = splitNumericElements(variant).join('');
      const normU = splitNumericElements(userRaw).join('');
      if (normU === normV) {
        anyCorrect = true;
        break;
      } else if (points === 2 && checkPartialMatch(userRaw, variant, points)) {
        anyPartial = true;
        // не прерываем — вдруг есть полностью корректный вариант дальше
      }
    } else {
      // текстовый вариант — сравним в нижнем регистре после нормализации
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

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

async function findExistingTable(possibleNames = []) {
  for (const name of possibleNames) {
    // пробуем сделать простой селект
    const { data, error } = await supabase.from(name).select('1').limit(1);
    if (!error) {
      // таблица существует (даже если пустая)
      return name;
    }
    // если ошибка - пропускаем, попробуем следующую
  }
  return null;
}

function isValidTaskId(taskId) {
  if (taskId == null) return false;
  if (typeof taskId === 'number' && Number.isInteger(taskId)) return true;
  if (typeof taskId === 'string') {
    // строка из цифр?
    return /^\d+$/.test(taskId.trim());
  }
  return false;
}

// ========== ПЕРЕПРОВЕРКА ПРЕДМЕТА ==========

async function recheckSubjectProgress(subject) {
  // пробуем найти таблицу прогресса (варианты)
  const progressTable = `${subject}_ege_progress`;
    const taskBankTable = `${subject}_ege_task_bank`;
  if (!progressTable) {
    console.warn(`Таблица прогресса не найдена для "${subject}" (ожидали ${subject}_progress или ${subject}_ege_progress). Пропускаем.`);
    return;
  }

  if (!taskBankTable) {
    console.warn(`Таблица заданий не найдена для "${subject}" (ожидали ${subject}_ege_task_bank или ${subject}_task_bank). Пропускаем.`);
    return;
  }

  console.log(`\n=== Перепроверка ${subject} (progress=${progressTable}, taskBank=${taskBankTable}) ===`);

  // Выбираем строки прогресса — ограничение безопасности, можно увеличить если нужно
  const { data: rows, error } = await supabase
    .from(progressTable)
    .select('user_id, task_id, user_answer, score')
    .limit(20000);

  if (error) {
    console.error(`Ошибка выборки из ${progressTable}:`, error);
    return;
  }

  let updated = 0;
  let skippedInvalidTaskId = 0;
  let missingTask = 0;

  for (const row of rows) {
    // защита: возможна ситуация, когда row.task_id = 'null' (строка) или другой мусор — пропускаем такие
    if (!isValidTaskId(row.task_id)) {
      console.warn(`Пропущено: user_id=${row.user_id}, task_id=${String(row.task_id)} — invalid task_id`);
      skippedInvalidTaskId++;
      continue;
    }

    const parsedTaskId = typeof row.task_id === 'number' ? row.task_id : parseInt(String(row.task_id).trim(), 10);

    // получаем эталон задания
    const { data: task, error: taskErr } = await supabase
      .from(taskBankTable)
      .select('answer, points')
      .eq('id', parsedTaskId)
      .single();

    if (taskErr || !task) {
      console.warn(`Задание не найдено: task_id=${parsedTaskId} (user_id=${row.user_id})`);
      missingTask++;
      continue;
    }

    const result = checkAnswer(row.user_answer, task.answer, task.points);

    if (result.score !== row.score) {
      // строго в запрошенном формате
      console.log(`user_id=${row.user_id}, task_id=${parsedTaskId}: старый=${row.score} → новый=${result.score}`);

      const { error: updErr } = await supabase
        .from(progressTable)
        .update({
          score: result.score,
          is_completed: result.isCorrect || result.isPartiallyCorrect,
          last_updated: new Date().toISOString()
        })
        .eq('user_id', row.user_id)
        .eq('task_id', parsedTaskId);

      if (updErr) {
        console.error(`Ошибка обновления (${row.user_id}, ${parsedTaskId}):`, updErr);
      } else {
        updated++;
      }
    }
  }

  console.log(`Итого для ${subject}: обновлено=${updated}, пропущено_invalid_task_id=${skippedInvalidTaskId}, missing_task=${missingTask}`);
}

// ========== MAIN ==========

async function main() {
  try {
    const subjects = ['chemistry', 'biology'];
    for (const s of subjects) {
      await recheckSubjectProgress(s);
    }
    console.log('\n✅ Перепроверка завершена');
  } catch (err) {
    console.error('Неожиданная ошибка в main:', err);
  }
}

main();
