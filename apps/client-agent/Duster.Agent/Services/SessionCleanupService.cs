namespace Duster.Agent.Services;

/// <summary>
/// Выход из Steam, Epic, Discord, Battle.net, браузеров при lock/конце сессии.
/// </summary>
public sealed class SessionCleanupService(ILogger<SessionCleanupService> logger)
{
    private static readonly (string Process, string? Args)[] Targets =
    [
        ("steam", "-shutdown"),
        ("EpicGamesLauncher", null),
        ("Discord", null),
        ("Battle.net", null),
        ("chrome", null),
        ("msedge", null),
        ("firefox", null),
        ("opera", null),
    ];

    public void RunCleanup()
    {
        logger.LogInformation("Session cleanup started");
        foreach (var (name, args) in Targets)
        {
            try
            {
                if (args != null)
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = name,
                        Arguments = args,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                    });
                }
                else
                {
                    foreach (var p in System.Diagnostics.Process.GetProcessesByName(name))
                    {
                        try { p.Kill(); } catch { /* ignore */ }
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "Cleanup skip {Name}", name);
            }
        }
    }
}
