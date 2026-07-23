# BALI — активация production

Пользовательское приложение: `https://bali-minsk-app.pages.dev`

Админка: `https://bali-minsk-app.pages.dev/admin/`

Бот: `@BaliMinskAppBot`

## 1. Supabase

Создать проект Supabase на бесплатном тарифе.

В SQL Editor последовательно выполнить:

1. `site/bali-production-schema.sql`
2. `site/bali-production-runtime-migration.sql`

## 2. Администратор

В `Authentication → Users` создать пользователя:

- Email: `balibali@bali.local`
- Password: пароль администратора BALI
- Email confirmed: включено

Логин, вводимый на странице админки: `BaliBali`.

Пароль не хранить в GitHub и не отправлять в переписке.

## 3. Конфигурация сайта

Из `Project Settings → API` взять:

- Project URL
- anon / publishable key

Вставить их в `site/config.js`:

```js
supabaseUrl: "...",
supabaseAnonKey: "...",
```

Anon/publishable key предназначен для браузерного приложения. Service role key в `config.js` запрещён.

## 4. Edge Functions

Развернуть функции из каталога `supabase/functions`:

- `telegram-webhook`
- `telegram-user-chat`
- `telegram-send-message`
- `telegram-prepare-share`
- `telegram-setup-webhook`
- `loyalty-action`
- `event-checkin-production`
- `social-production`

Настройки проверки JWT находятся в `supabase/config.toml`.

## 5. Secrets

В Supabase Edge Function Secrets добавить самостоятельно, не публикуя значения:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET` — случайная длинная строка
- `TELEGRAM_WEBAPP_URL=https://bali-minsk-app.pages.dev`
- `TELEGRAM_BOT_USERNAME=BaliMinskAppBot`

`SUPABASE_URL`, `SUPABASE_ANON_KEY` и `SUPABASE_SERVICE_ROLE_KEY` предоставляются средой Supabase.

## 6. Telegram webhook

После входа в BALI Admin открыть `Настройки` и нажать `Подключить Telegram webhook`.

Токен бота остаётся в Supabase Secrets и не передаётся браузеру.

## 7. Проверка

1. Пользователь открывает `@BaliMinskAppBot` и нажимает Start.
2. Сообщение появляется в `Админка → Сообщения`.
3. Ответ из админки приходит пользователю от бота.
4. В приложении пользователя открывается профиль → Сообщения.
5. Создать событие, создать его QR и проверить вход.
6. Проверить начисление баллов, VIP, заявку на фишки, приглашение друга и репост события.
