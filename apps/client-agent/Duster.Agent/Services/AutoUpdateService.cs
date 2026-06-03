using System.Net.Http.Json;
using System.Security.Cryptography;

namespace Duster.Agent.Services;

public sealed class AutoUpdateService(
    ILogger<AutoUpdateService> logger,
    AgentConfig config,
    IHttpClientFactory httpFactory)
{
    private const string Component = "client-agent";
    private static readonly string Version = typeof(AutoUpdateService).Assembly.GetName().Version?.ToString() ?? "0.4.0";

    public async Task CheckAndApplyAsync(CancellationToken ct)
    {
        var http = httpFactory.CreateClient();
        http.BaseAddress = new Uri(config.ServerUrl.TrimEnd('/') + "/");
        var res = await http.GetFromJsonAsync<UpdateDto>(
            $"api/agent/updates/{Component}?version={Version}",
            ct);
        if (res?.UpdateAvailable != true || string.IsNullOrEmpty(res.DownloadUrl)) return;

        logger.LogInformation("Update {Ver} available", res.Version);
        var tmp = Path.Combine(Path.GetTempPath(), $"duster-agent-{res.Version}.zip");
        await using (var stream = await http.GetStreamAsync(res.DownloadUrl, ct))
        await using (var file = File.Create(tmp))
            await stream.CopyToAsync(file, ct);

        logger.LogInformation("Update downloaded to {Path} - run install script to apply", tmp);
    }

    private sealed class UpdateDto
    {
        public bool UpdateAvailable { get; set; }
        public string? Version { get; set; }
        public string? DownloadUrl { get; set; }
    }
}
