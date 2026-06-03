# Duster Agent (Windows)

Native-клиент: служба Windows, WebSocket к серверу, выполнение команд (lock / shutdown / restart).

## Настройка

`Duster.Agent/appsettings.json`:

```json
{
  "Duster": {
    "ServerUrl": "http://192.168.10.10:3847",
    "AgentToken": "токен из админки → Компьютеры",
    "HeartbeatSeconds": 30
  }
}
```

## Сборка

```powershell
dotnet build -c Release
dotnet run --project Duster.Agent
```

## Установка службы

```powershell
sc.exe create DusterAgent binPath= "C:\Duster\apps\client-agent\Duster.Agent\bin\Release\net8.0-windows\Duster.Agent.exe" start= auto
sc.exe start DusterAgent
```

Удаление: `sc.exe delete DusterAgent`
