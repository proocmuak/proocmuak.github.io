import logging
from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, ConversationHandler

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Состояния для ConversationHandler
DESCRIPTION, SCREENSHOT = range(2)

# ID чата для пересылки жалоб (замените на ваш)
SUPPORT_CHAT_ID = -1002952758067

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Начало работы с ботом"""
    welcome_text = (
        "👋 Привет! Это бот для сообщения о проблемах на сайте.\n\n"
        "Если вы обнаружили что-то, что не работает, пожалуйста, опишите проблему "
        "и при необходимости прикрепите скриншот.\n\n"
        "Чтобы начать, нажмите /report"
    )
    await update.message.reply_text(welcome_text)

async def report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Начало процесса отправки жалобы"""
    await update.message.reply_text(
        "📝 Пожалуйста, опишите проблему, которую вы обнаружили на сайте:\n\n"
        "• Что именно не работает?\n"
        "• На какой странице это происходит?\n"
        "• Когда это началось?\n\n"
        "Чтобы отменить отправку, нажмите /cancel",
        reply_markup=ReplyKeyboardRemove()
    )
    return DESCRIPTION

async def description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Получение описания проблемы"""
    context.user_data['description'] = update.message.text
    context.user_data['user'] = update.effective_user
    
    await update.message.reply_text(
        "📸 Хотите прикрепить скриншот? Отправьте фото или нажмите /skip если скриншот не нужен"
    )
    return SCREENSHOT

async def screenshot(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Получение скриншота"""
    if update.message.photo:
        # Сохраняем самое большое фото
        photo_file = await update.message.photo[-1].get_file()
        context.user_data['screenshot'] = photo_file.file_id
        
    await send_report(update, context)
    return ConversationHandler.END

async def skip_screenshot(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Пропуск отправки скриншота"""
    context.user_data['screenshot'] = None
    await send_report(update, context)
    return ConversationHandler.END

async def send_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отправка жалобы в чат поддержки"""
    user_data = context.user_data
    user = user_data['user']
    
    # Формируем сообщение для чата поддержки
    message_text = (
        "🚨 НОВАЯ ЖАЛОБА НА САЙТ\n\n"
        f"👤 Пользователь: {user.full_name} (@{user.username})\n"
        f"🆔 ID: {user.id}\n\n"
        f"📋 Описание:\n{user_data['description']}\n\n"
        f"📅 Время: {update.message.date}"
    )
    
    try:
        # Отправляем сообщение в чат поддержки
        if 'screenshot' in user_data and user_data['screenshot']:
            await context.bot.send_photo(
                chat_id=SUPPORT_CHAT_ID,
                photo=user_data['screenshot'],
                caption=message_text
            )
        else:
            await context.bot.send_message(
                chat_id=SUPPORT_CHAT_ID,
                text=message_text
            )
            
        # Подтверждаем пользователю
        await update.message.reply_text(
            "✅ Ваша жалоба успешно отправлена! Спасибо за обратную связь!\n\n"
            "Мы рассмотрим ваше сообщение в ближайшее время.",
            reply_markup=ReplyKeyboardRemove()
        )
        
    except Exception as e:
        logger.error(f"Ошибка при отправке жалобы: {e}")
        await update.message.reply_text(
            "❌ Произошла ошибка при отправке жалобы. Попробуйте позже."
        )
    
    # Очищаем данные пользователя
    context.user_data.clear()

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отмена отправки жалобы"""
    await update.message.reply_text(
        "❌ Отправка жалобы отменена.",
        reply_markup=ReplyKeyboardRemove()
    )
    context.user_data.clear()
    return ConversationHandler.END

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик ошибок"""
    logger.error(msg="Exception while handling update:", exc_info=context.error)
    
    if update and update.effective_message:
        await update.effective_message.reply_text(
            "❌ Произошла ошибка. Попробуйте еще раз или обратитесь к администратору."
        )

def main():
    """Запуск бота"""
    # Замените 'YOUR_BOT_TOKEN' на токен вашего бота
    application = Application.builder().token('8455790419:AAGTH-ycfp6jQkVET_H81o6VtLEqJQgNeb4').build()
    
    # Настройка обработчиков
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler('report', report)],
        states={
            DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, description)],
            SCREENSHOT: [
                MessageHandler(filters.PHOTO, screenshot),
                CommandHandler('skip', skip_screenshot)
            ],
        },
        fallbacks=[CommandHandler('cancel', cancel)],
    )
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(conv_handler)
    application.add_error_handler(error_handler)
    
    # Запуск бота
    print("Бот запущен...")
    application.run_polling()

if __name__ == '__main__':
    main()