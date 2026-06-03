using System.Net.Http.Json;
using System.Text.Json;

namespace Duster.Agent.Services;

public sealed class ProcessWatchdog(
    ILogger<ProcessWatchdog> logger,
    AgentConfig config)
{
    public async Task ScanAndEnforceAsync(string? jwt, CancellationToken ct)
    {
        if (jwt == null) return;
        var patterns = await FetchPatternsAsync(jwt, ct);
        if (patterns.Count == 0) return;

        foreach (var proc in System.Diagnostics.Process.GetProcesses())
        {
            try
            {
                var name = proc.ProcessName;
                foreach (var p in patterns)
                {
                    if (!name.Contains(p.Pattern, StringComparison.OrdinalIgnoreCase)) continue;
                    if (p.Action == "kill")
                    {
                        logger.LogWarning("Anticheat kill {Name} pid={Pid}", name, proc.Id);
                        proc.Kill();
                    }
                }
            }
            catch { /* access denied */ }
            finally
            {
                proc.Dispose();
            }
        }
    }

    public object[] GetProcessList()
    {
        return System.Diagnostics.Process.GetProcesses()
            .Select(p =>
            {
                try
                {
                    return new { pid = p.Id, name = p.ProcessName, memoryMb = p.WorkingSet64 / (1024 * 1024) };
                }
                catch
                {
                    return new { pid = p.Id, name = "?", memoryMb = 0L };
                }
                finally
                {
                    p.Dispose();
                }
            })
            .OrderByDescending(x => x.memoryMb)
            .Take(40)
            .ToArray();
    }

    private async Task<List<(string Pattern, string Action)>> FetchPatternsAsync(string jwt, CancellationToken ct)
    {
        try
        {
            using var http = new HttpClient { BaseAddress = new Uri(config.ServerUrl.TrimEnd('/') + "/") };
            http.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", jwt);
            var list = await http.GetFromJsonAsync<JsonElement[]>(
                $"api/public/anticheat-patterns?agentToken={Uri.EscapeDataString(config.AgentToken)}", ct);
            if (list == null) return [];
            return list
                .Select(e => (e.GetProperty("namePattern").GetString()!, e.GetProperty("action").GetString() ?? "kill"))
                .ToList();
        }
        catch
        {
            return [];
        }
    }
}
