using System.Net.Http.Json;

namespace Duster.Agent.Services;

public sealed class HardwareTelemetryService(
    ILogger<HardwareTelemetryService> logger,
    AgentConfig config,
    IHttpClientFactory httpFactory)
{
    public async Task ReportAsync(string? jwt, CancellationToken ct)
    {
        if (jwt == null) return;
        float cpu = 0, ram = 0;
        try
        {
            var proc = System.Diagnostics.Process.GetCurrentProcess();
            ram = (float)GC.GetTotalMemory(false) / (1024 * 1024 * 1024) * 100;
            cpu = (float)(Environment.ProcessorCount > 0 ? 10 : 0);
        }
        catch { /* */ }

        var peripherals = new List<object>();
        try
        {
            if (OperatingSystem.IsWindows())
            {
                using var searcher = new System.Management.ManagementObjectSearcher(
                    "SELECT Name FROM Win32_PnPEntity WHERE PNPClass='Mouse' OR PNPClass='Keyboard'");
                foreach (var o in searcher.Get())
                    peripherals.Add(new { type = "input", name = o["Name"]?.ToString() ?? "device", connected = true });
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "WMI peripherals");
        }

        var http = httpFactory.CreateClient();
        http.BaseAddress = new Uri(config.ServerUrl.TrimEnd('/') + "/");
        using var req = new HttpRequestMessage(HttpMethod.Post, "api/agent/telemetry");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", jwt);
        req.Content = JsonContent.Create(new
        {
            cpuPercent = cpu,
            ramPercent = ram,
            cpuTemp = (double?)null,
            gpuTemp = (double?)null,
            peripherals,
        });
        await http.SendAsync(req, ct);
    }
}
