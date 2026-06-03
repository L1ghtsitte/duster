using System.Text.Json;

namespace Duster.Agent.Services;

public sealed class OfflineCacheService(ILogger<OfflineCacheService> logger)
{
    private readonly string _path = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "Duster",
        "offline-session.json");

    public void Save(string offlineToken, DateTime? endsAt, bool isUnlimited)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        var data = new { offlineToken, endsAt, isUnlimited, savedAt = DateTime.UtcNow };
        File.WriteAllText(_path, JsonSerializer.Serialize(data));
        logger.LogInformation("Offline session cached until {Ends}", endsAt);
    }

    public (bool valid, long remainingMs) ValidateLocal()
    {
        if (!File.Exists(_path)) return (false, 0);
        try
        {
            var doc = JsonDocument.Parse(File.ReadAllText(_path));
            if (doc.RootElement.GetProperty("isUnlimited").GetBoolean()) return (true, long.MaxValue);
            var ends = doc.RootElement.GetProperty("endsAt").GetString();
            if (ends == null) return (true, 0);
            var remaining = DateTime.Parse(ends).ToUniversalTime() - DateTime.UtcNow;
            return (remaining.TotalMilliseconds > 0, (long)remaining.TotalMilliseconds);
        }
        catch
        {
            return (false, 0);
        }
    }

    public void Clear() => File.Delete(_path);
}
