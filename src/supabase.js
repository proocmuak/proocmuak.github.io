// src/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mltqewxnxinaytavbmds.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sdHFld3hueGluYXl0YXZibWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzMyMTYsImV4cCI6MjA2OTc0OTIxNn0.YCH1G-aDCCc_bse_uVhxqBj4slsN-iDiFdoYZ1Qwsm8'

// Создаем базовый клиент
const baseSupabase = createClient(supabaseUrl, supabaseAnonKey)

// Таблица для логов ошибок
const ERROR_TABLE_NAME = 'client_errors'

/**
 * Логирование ошибки в Supabase
 */
async function logErrorToSupabase(error, context = {}) {
  try {
    const errorData = {
      error_message: error?.message || error.toString(),
      error_stack: error?.stack,
      error_name: error?.name,
      context: context,
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString(),
    }

    // Получаем ID пользователя если есть
    const { data: { user } } = await baseSupabase.auth.getUser()
    if (user) {
      errorData.user_id = user.id
    }

    const { error: insertError } = await baseSupabase
      .from(ERROR_TABLE_NAME)
      .insert([errorData])

    if (insertError) {
      console.error('Failed to log error to Supabase:', insertError)
    } else {
      console.log('Error logged to Supabase')
    }
  } catch (loggingError) {
    console.error('Failed to log error (critical):', loggingError)
  }
}

/**
 * Обертка для всех методов Supabase с обработкой ошибок
 */
function createSupabaseWithErrorHandling(client) {
  const handler = {
    get(target, prop) {
      const value = target[prop]
      
      // Если это объект (как from, auth и т.д.), возвращаем проксированную версию
      if (typeof value === 'object' && value !== null) {
        return new Proxy(value, handler)
      }
      
      // Если это функция, оборачиваем в обработчик ошибок
      if (typeof value === 'function') {
        return async function (...args) {
          try {
            const result = await value.apply(target, args)
            
            // Проверяем ошибки в ответе Supabase
            if (result?.error) {
              await logErrorToSupabase(result.error, {
                method: prop,
                args: args.map(arg => 
                  typeof arg === 'object' ? JSON.stringify(arg).substring(0, 200) : String(arg)
                ),
                source: 'supabase_method'
              })
            }
            
            return result
          } catch (error) {
            await logErrorToSupabase(error, {
              method: prop,
              args: args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg).substring(0, 200) : String(arg)
              ),
              source: 'supabase_method_exception'
            })
            throw error
          }
        }
      }
      
      return value
    }
  }
  
  return new Proxy(client, handler)
}

// Создаем клиент с обработкой ошибок
export const supabase = createSupabaseWithErrorHandling(baseSupabase)

/**
 * Вызов edge-функции с обработкой ошибок
 */
export async function callFunction(fnName, body, context = {}) {
  try {
    console.log('Calling function:', fnName, 'with body:', body)
    
    const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(body),
    })

    console.log('Response status:', res.status, res.statusText)
    
    if (!res.ok) {
      let errorText = 'Unknown error'
      try {
        errorText = await res.text()
      } catch (e) {
        errorText = `CORS error or network issue: ${res.status} ${res.statusText}`
      }
      
      const error = new Error(`Function call failed: ${res.status} ${res.statusText} - ${errorText}`)
      
      await logErrorToSupabase(error, {
        function: fnName,
        request_body: body,
        response_status: res.status,
        response_text: errorText,
        ...context
      })
      
      throw error
    }

    const data = await res.json()
    console.log('Function response:', data)
    return data
    
  } catch (err) {
    console.error('Call function error:', err)
    
    await logErrorToSupabase(err, {
      function: fnName,
      request_body: body,
      ...context
    })
    
    throw err
  }
}

/**
 * Ручное логирование ошибок из компонентов
 */
export async function logClientError(error, context = {}) {
  return await logErrorToSupabase(error, context)
}

/**
 * Глобальный обработчик ошибок Vue/JavaScript
 */
export function setupGlobalErrorHandling() {
  if (typeof window === 'undefined') return
  
  // Обработчик ошибок JavaScript
  window.addEventListener('error', (event) => {
    logErrorToSupabase(event.error, {
      type: 'global_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  })

  // Обработчик необработанных промисов
  window.addEventListener('unhandledrejection', (event) => {
    logErrorToSupabase(event.reason, {
      type: 'unhandled_rejection'
    })
  })

  // Обработчик ошибок Vue (добавить в main.js)
  // app.config.errorHandler = (err, instance, info) => {
  //   logErrorToSupabase(err, {
  //     type: 'vue_error',
  //     component: instance?.$options?.name,
  //     lifecycle: info
  //   })
  // }
}

// Автоматически настраиваем глобальные обработчики при импорте
if (typeof window !== 'undefined') {
  setupGlobalErrorHandling()
}