# BALI HR Mini App

В репозитории сохранены два изолированных режима:

- `/demo` — существующая статическая браузерная демонстрация с локальными
  тестовыми данными;
- `/app` — полное Telegram Mini App BALI с серверной сессией и PostgreSQL;
- `/admin` — единый BALI Control Center с CRM, событиями, бронированиями,
  схемами зала, QR, экономикой, дизайном, рассылками, модерацией, клановыми
  чатами, audit и rate limits.

В `staging` и `production` маршрут `/demo` отключён. Demo/localStorage никогда
не является источником production-авторизации или production-данных.

## Реализованные production-домены

- Telegram auth и отдельная admin auth/RBAC.
- BALI People, privacy, знакомства, блокировки, жалобы и direct chat.
- События, attendance и приглашения.
- Пользовательские BALI Family и корпоративные кланы, отдельные рейтинги,
  membership `1 user + 1 corporate`, закрытые чаты и permission-матрица.
- Версионные схемы зала, столы/элементы, assignment событиям, server holds,
  бронирования и одноразовый QR check-in.
- BALI Points ledger, награды, подарки, VIP, Shop и «Три в ряд» с
  автоматическими недельными сезонами и фактической выдачей Top-10
  баллов, наград и VIP.
- Уведомления/outbox, CRM-рассылки с preview+confirm и opt-out.
- Настраиваемые изображения, названия блоков, размеры, нижняя навигация,
  игровые фишки и Top-10 награды с возвратом исходных значений.
- Неизменяемый audit log, preflight, backup media+PostgreSQL и rollback tools.

## Локальный запуск

Требуются Node.js 22+ и PostgreSQL с существующей базовой таблицей
`public.events`.

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run migrate
npm.cmd run dev
```

Production-конфигурация требует:

- `BALI_ENV=production`;
- `DATABASE_URL`;
- `TELEGRAM_BOT_TOKEN`;
- `TELEGRAM_BOT_URL`;
- случайный `SESSION_SECRET` длиной не менее 32 символов;
- постоянный диск `BALI_UPLOAD_DIR`;
- HTTPS и `TRUST_PROXY=1`, если TLS завершается на доверенном reverse proxy.

Для первого администратора заполните `ADMIN_BOOTSTRAP_EMAIL` и
`ADMIN_BOOTSTRAP_PASSWORD`. После первого успешного bootstrap удалите пароль
из окружения и перезапустите сервис.

## Telegram-вход

Клиент отправляет серверу исходный `Telegram.WebApp.initData`. Сервер проверяет
HMAC и возраст `auth_date`, берёт Telegram ID только из подписанных данных и
создаёт случайную серверную сессию. В cookie хранится непрозрачный токен, в
PostgreSQL — только его SHA-256.

Пользовательская и административная сессии используют разные HttpOnly cookie.
Ни одна из них не заменяет другую.

## Клановые права

Активный участник получает базовые права чтения, записи, ответов, голосования и
жалоб. Управленческие права leader проверяются backend на каждой операции.
Deputy и moderator сами по себе не наследуют полномочия leader: администратор
может выдать или запретить ровно один permission с ограниченным сроком.

Выход или исключение из клана сразу закрывает историю чата. Полный список
кланов и рейтинги публичны для авторизованных пользователей, история чужого
чата — нет.

## Миграции, backup и откат

```powershell
npm.cmd run migrations:check
npm.cmd run backup:postgres
npm.cmd run migrations:preflight
npm.cmd run migrate
```

`migrate` применяет `*.up.sql` по имени в транзакции и сохраняет checksum.
Применённые файлы не изменяются; следующее изменение оформляется новой
миграцией. Backup включает custom-format PostgreSQL dump, проверку
`pg_restore --list`, SHA-256 и копию `BALI_UPLOAD_DIR` с checksum каждого файла.

Полный порядок выпуска и отката:
[docs/production-release-runbook.md](docs/production-release-runbook.md).

## Проверки

```powershell
npm.cmd run check
npm.cmd audit --omit=dev --audit-level=high
```

CI выполняет migration checks, ESLint, TypeScript, server security/integration
tests, demo smoke tests, production build и dependency audit.

Матрица обязательных 50 сценариев и ещё не подтверждённые device/staging
проверки: [docs/production-e2e-matrix.md](docs/production-e2e-matrix.md).
