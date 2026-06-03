# Duster Shell (WPF)

Native-оболочка Windows вместо веб-киоска.

## Настройка

1. Файл `C:\Duster\server.url` - одна строка, URL сервера: `http://192.168.10.10:3847`
2. Переменная `DUSTER_PC=3` - номер станции (или правьте в коде).

## Сборка

```powershell
cd apps\client-shell\Duster.Shell
dotnet build -c Release
```

## Автозапуск вместо Explorer

См. `docs/ru/install-guide.md` → раздел WPF Shell.
