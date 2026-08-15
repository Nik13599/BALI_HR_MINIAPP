# BALI Native (iOS / Android)

Эта папка содержит Capacitor-оболочку для отдельного мобильного приложения BALI.

## Быстрая проверка iOS

1. Разверните Node/Express backend из этого репозитория по HTTPS и примените все миграции, включая `018_mobile_password_auth.up.sql`.
2. Убедитесь, что production URL открывает `/app` и мобильную форму входа.
3. На macOS:

```bash
cd native
npm install
BALI_MOBILE_SERVER_URL=https://your-bali-host.example/app npx cap add ios
BALI_MOBILE_SERVER_URL=https://your-bali-host.example/app npx cap sync ios
BALI_MOBILE_SERVER_URL=https://your-bali-host.example/app npx cap open ios
```

4. В Xcode выберите собственный Team / Apple ID и уникальный Bundle Identifier при необходимости.
5. Выберите подключённый iPhone или Simulator и запустите приложение.

## GitHub Actions

Workflow `.github/workflows/build-ios-simulator.yml` принимает `server_url` вручную и создаёт ZIP с unsigned `App.app` для iOS Simulator.

## Важно

`server.url` используется здесь только для максимально быстрой тестовой оболочки, чтобы проверить текущий web-клиент как отдельное iOS-приложение без Telegram Mini App. Для App Store production-сборки frontend следует упаковать локально в native bundle, а backend/API вынести на HTTPS endpoint.

Для установки на физический iPhone требуется подпись Apple через Xcode (или TestFlight/App Store distribution). GitHub Actions simulator artifact не является подписанным IPA для физического устройства.
