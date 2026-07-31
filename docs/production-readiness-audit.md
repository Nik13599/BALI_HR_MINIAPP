# BALI production readiness audit

Дата baseline: 2026-07-30
Исходный снимок: PR #23, commit `107d533`
Production-кандидат: `codex/production-ready-bali`

## Зафиксированный baseline

- Проверенный backup кода: `BALI_HR_MINIAPP-before-production-2026-07-30.bundle`.
- Bundle содержит полную историю 13 refs и проходит `git bundle verify`.
- PR #23 основан на `gh-pages`; `main` и `gh-pages` имели разные корневые истории.
- Текущий снимок содержит все 233 файла `main` и 106 дополнительных файлов. Файлов, существующих только в `main`, нет.
- Production-ветка соединяет историю полного приложения и `main`, не изменяя дерево файлов.
- Production PostgreSQL в рабочей среде недоступен: `DATABASE_URL` не задан. Миграции на реальных данных не запускались.

## Текущее состояние

| Область | Состояние до production-работ | Основной разрыв |
| --- | --- | --- |
| Telegram auth | Частично готово | Полный интерфейс `/app` не использует эту сессию |
| Admin auth/RBAC | Частично готово | `/admin` содержит только управление клановыми чатами |
| BALI People/privacy | Частично готово | Нет server connections, blocks, reports и direct messages |
| Приглашения на события | Нет в production | В beta-интерфейсе действие ранее удалено |
| Кланы и общий чат | Готовая основа | Нет production invitations и пользовательского создания BALI Family |
| События/attendance | Demo/local | Нет полного server API и раздельных состояний attendance/check-in |
| Раскладки и столы | Demo/local | Нет versioned layouts, publish/archive и назначения событию |
| Бронирования | Demo/local | Нет server holds, concurrency и канонической связи с CRM |
| QR check-in | Demo/local | Нет единой идемпотентной серверной операции |
| Игра «Три в ряд» | Demo/local | Сессии, результаты, жизни и рейтинг не хранятся на сервере |
| BALI Points | Demo/local | Нет транзакционного server ledger |
| Награды | Demo/local | Нет server definitions/grants и защиты от повторной выдачи |
| Подарки | Demo/local | Нет server purchase/redemption и one-time QR |
| VIP | Demo/local | Нет server plans/subscriptions/history |
| BALI Shop | Demo/local | Нет server catalog/orders/redemption |
| Уведомления | Нет | Нет in-app outbox/preferences/Telegram delivery log |
| CRM-рассылки | Нет | Нет segment preview, confirmation, idempotency и opt-out |
| Полная CRM | Demo/local | Production shell показывает только клановые чаты |
| CI/CD | Частично | Нет production smoke, booking concurrency, backup/rollback jobs |

## Измеренный разрыв demo/production

- 187 JavaScript-модулей и 29 CSS-файлов формируют актуальный полный интерфейс.
- 79 файлов напрямую обращаются к `localStorage` или `sessionStorage`.
- Найдено 194 прямых обращения к browser storage.
- `site/index.html`, `site/config.js`, `site/store.js` и loader принудительно включают demo/local-only режим.
- `/app` обслуживает отдельный клановый shell `telegram-app.html`.
- `/admin` обслуживает отдельный shell `admin-production.html` только для кланов.
- Production backend содержит 26 таблиц и 56 route declarations: auth, people privacy и клановые функции.
- Отсутствующие домены нельзя считать production-готовыми только потому, что они работают в browser demo.

## Канонические идентификаторы

- Главный ключ пользователя: `app_users.user_key`.
- Telegram ID должен оставаться уникальным и связываться через `telegram_accounts`.
- Имя, телефон и username не используются как единственное основание автоматического объединения.
- Сомнительные legacy-сопоставления помещаются в очередь ручной проверки.

## Стратегия миграций

- Применённые миграции `001–003` не изменяются.
- Production-модель добавляется новыми обратимыми миграциями `004+`.
- Перед применением на staging выполняются backup и preflight-отчёт дублей.
- Любая финансовая, booking, check-in и redemption операция получает `idempotency_key`.
- Уникальные ограничения базы остаются последней линией защиты от повторов и гонок.
- Down-миграции предназначены только для контролируемого отката после backup.

## Стратегия интерфейсов

- `/app` должен использовать актуальный полный храмовый интерфейс, но production bootstrap и API.
- `/admin` должен использовать актуальную полную CRM-админку, но production admin session и API.
- `/demo` сохраняет существующий localStorage adapter только для демонстрации.
- Production bootstrap не загружает demo seed, demo toolbar, demo synchronizers или local-only store.
- Переход выполняется по доменам; каждый переведённый домен получает API, тесты и явный запрет local fallback в production.

## Блокеры реального выпуска

1. Нет доступа к staging/production PostgreSQL для backup, preflight и реального migration rehearsal.
2. Нет Telegram bot token для end-to-end проверки реального `initData` и доставки уведомлений.
3. Не определён production runtime/deploy target для Node.js процесса и PostgreSQL.
4. Нельзя выпускать production до прохождения всех concurrency, security, migration и responsive-проверок.

## Правило готовности

Demo smoke не является доказательством production-готовности. Область считается готовой только после наличия server schema, server API, backend authorization/idempotency, integration-тестов и проверки соответствующего production-интерфейса.
