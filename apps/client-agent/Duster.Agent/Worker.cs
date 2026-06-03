using Duster.Agent.Services;

namespace Duster.Agent;

public sealed class Worker(
    ILogger<Worker> logger,
    AgentConfig config,
    ServerConnection connection,
    HardwareTelemetryService telemetry,
    AutoUpdateService updater,
    OfflineCacheService offline,
    ProcessWatchdog watchdog) : BackgroundService
{
    private int _tick;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (string.IsNullOrWhiteSpace(config.AgentToken))
        {
            logger.LogError("Set Duster:AgentToken in appsettings.json");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await connection.EnsureConnectedAsync(stoppingToken);
                await connection.SendHeartbeatAsync(stoppingToken);
                if (_tick % 4 == 0)
                    await telemetry.ReportAsync(connection.Jwt, stoppingToken);
                if (_tick % 120 == 0)
                    await updater.CheckAndApplyAsync(stoppingToken);
                if (_tick % 15 == 0)
                    await watchdog.ScanAndEnforceAsync(connection.Jwt, stoppingToken);
            }
            catch
            {
                var (valid, remaining) = offline.ValidateLocal();
                if (valid)
                    logger.LogInformation("Offline mode: {Ms} ms remaining", remaining);
            }

            _tick++;
            await Task.Delay(TimeSpan.FromSeconds(config.HeartbeatSeconds), stoppingToken);
        }
    }
}
