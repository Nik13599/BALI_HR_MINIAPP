# BALI production release runbook

## Требования

- Node.js 22+.
- PostgreSQL с текущей базовой схемой BALI.
- HTTPS endpoint для Node.js-приложения.
- Настроенный Telegram Bot и Mini App URL.
- Переменные из `.env.example`; для production обязательно `BALI_ENV=production`,
  `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_URL` и случайный
  `SESSION_SECRET` длиной не менее 32 символов.
- Постоянный диск для `BALI_UPLOAD_DIR`. Временная файловая система для
  админских изображений недопустима.

## Staging rehearsal

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd audit --omit=dev --audit-level=high
npm.cmd run backup:postgres
npm.cmd run migrate
npm.cmd run migrations:preflight
npm.cmd run build
npm.cmd start
```

После запуска проверить `/api/v1/health`, затем выполнить все строки
`DEVICE` и `BLOCKED` из `docs/production-e2e-matrix.md`. Backup считается
готовым только если `pg_restore --list` завершился успешно и JSON-манифест
содержит checksum дампа и список/checksum загруженных медиа.

## Первый администратор

`ADMIN_BOOTSTRAP_EMAIL` и `ADMIN_BOOTSTRAP_PASSWORD` используются только для
одноразового bootstrap. После успешного входа удалить bootstrap-пароль из
окружения и перезапустить сервис.

## Production

1. Зафиксировать SHA релизного commit.
2. Остановить записи либо включить maintenance-window.
3. Сделать новый DB+media backup.
4. Восстановить backup в отдельный staging-кластер, применить миграции и
   выполнить preflight; blocking count должен быть `0`.
5. Применить уже отрепетированные миграции в production.
6. Повторно выполнить preflight; blocking count должен быть `0`.
7. Запустить сборку и сервис.
8. Проверить `/app`, `/admin`, Telegram auth, одну тестовую бронь и QR.
9. Возобновить записи и наблюдать ошибки, latency и outbox.

## Откат

Предпочтительный откат кода — вернуть предыдущий образ/commit без down-миграций,
пока новая схема обратно совместима. Если нужен откат схемы:

```powershell
$env:ROLLBACK_TO="012_content_defaults.up.sql"
$env:CONFIRM_ROLLBACK="YES"
npm.cmd run migrations:rollback
```

Down-миграции могут удалять новые данные. Их разрешено запускать только после
проверенного backup и подтверждения точного target. Для полного восстановления
использовать новый PostgreSQL-кластер, `pg_restore`, затем вернуть каталог
медиа из соответствующей папки `.uploads` и сверить manifest checksums.
