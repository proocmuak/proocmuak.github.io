export default {
  async fetch(request, env) {
    const SUPABASE_URL = 'https://mltqewxnxinaytavbmds.supabase.co'; // ЗАМЕНИТЕ НА ВАШ URL

    const url = new URL(request.url);
    const targetUrl = new URL(url.pathname + url.search, SUPABASE_URL);

    // Создаем новый запрос на основе оригинального
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.blob() : null,
      redirect: 'follow',
    });

    // Отправляем запрос в Supabase
    const response = await fetch(proxyRequest);

    // Клонируем ответ и добавляем CORS-заголовки, чтобы браузер не ругался
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', '*');

    return newResponse;
  },
};