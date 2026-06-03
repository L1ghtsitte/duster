using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace Duster.Agent.Services;

public sealed class ServerConnection(
    ILogger<ServerConnection> logger,
    AgentConfig config,
    MachineControl machine,
    ScreenshotService screenshots,
    SessionCleanupService cleanup,
    UsbPolicyService usb,
    OfflineCacheService offline,
    ProcessWatchdog watchdog,
    WebRtcDesktopService webRtcDesktop)
{
    private readonly HttpClient _http = new() { BaseAddress = new Uri(config.ServerUrl.TrimEnd('/') + "/") };
    private string? _jwt;
    private ClientWebSocket? _ws;
    private CancellationTokenSource? _streamCts;
    private int _streamDelayMs = 200;

    public string? Jwt => _jwt;

    public async Task EnsureConnectedAsync(CancellationToken ct)
    {
        if (_jwt == null)
        {
            var reg = await _http.PostAsJsonAsync("api/agent/register", new { agentToken = config.AgentToken }, ct);
            reg.EnsureSuccessStatusCode();
            var doc = await reg.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            _jwt = doc.GetProperty("token").GetString();
        }

        if (_ws is { State: WebSocketState.Open }) return;

        var wsUri = new Uri(config.ServerUrl.Replace("http", "ws").TrimEnd('/') + "/ws");
        _ws = new ClientWebSocket();
        await _ws.ConnectAsync(wsUri, ct);
        await _ws.SendAsync(
            Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { type = "auth", token = _jwt })),
            WebSocketMessageType.Text,
            true,
            ct);
        _ = Task.Run(() => ReceiveLoop(_ws, ct), ct);
    }

    public async Task SendHeartbeatAsync(CancellationToken ct)
    {
        if (_jwt == null) return;
        using var req = new HttpRequestMessage(HttpMethod.Post, "api/agent/heartbeat");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _jwt);
        req.Content = JsonContent.Create(new { agentVersion = "0.6.0" });
        await _http.SendAsync(req, ct);
    }

    private async Task ReceiveLoop(ClientWebSocket ws, CancellationToken ct)
    {
        var buffer = new byte[16384];
        while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            var result = await ws.ReceiveAsync(buffer, ct);
            if (result.MessageType == WebSocketMessageType.Close) break;
            var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
            try
            {
                var doc = JsonDocument.Parse(json);
                var msgType = doc.RootElement.GetProperty("type").GetString();
                if (msgType == "webrtc")
                {
                    await HandleWebRtcSignalAsync(doc.RootElement, ct);
                    continue;
                }
                if (msgType != "command") continue;
                var payload = doc.RootElement.GetProperty("payload");
                await HandleCommandAsync(payload, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "WS");
            }
        }
    }

    private async Task HandleCommandAsync(JsonElement payload, CancellationToken ct)
    {
        var cmd = payload.GetProperty("type").GetString();
        switch (cmd)
        {
            case "lock":
                cleanup.RunCleanup();
                machine.Lock();
                offline.Clear();
                break;
            case "cleanup_session":
                cleanup.RunCleanup();
                break;
            case "unlock":
                break;
            case "shutdown":
                machine.Shutdown(payload.TryGetProperty("force", out var f) && f.GetBoolean());
                break;
            case "restart":
                machine.Restart(payload.TryGetProperty("force", out var r) && r.GetBoolean());
                break;
            case "logoff":
                machine.Logoff();
                break;
            case "message":
                var text = payload.GetProperty("text").GetString() ?? "";
                if (text.StartsWith("OFFLINE_TOKEN:", StringComparison.Ordinal))
                    offline.Save(text["OFFLINE_TOKEN:".Length..], null, false);
                else
                    machine.ShowMessage(text);
                break;
            case "apply_usb_policy":
                usb.Apply(
                    payload.GetProperty("blockStorage").GetBoolean(),
                    payload.GetProperty("allowCharge").GetBoolean());
                break;
            case "screenshot":
                await SendScreenshotAsync(ct);
                break;
            case "stream_start":
                if (payload.TryGetProperty("fps", out var fpsEl))
                    _streamDelayMs = Math.Max(50, 1000 / Math.Max(1, fpsEl.GetInt32()));
                _streamCts?.Cancel();
                _streamCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                _ = StreamLoopAsync(_streamCts.Token);
                break;
            case "stream_stop":
                _streamCts?.Cancel();
                break;
            case "list_processes":
                await SendProcessListAsync(ct);
                break;
            case "webrtc_stream_start":
                var fps = payload.TryGetProperty("fps", out var fp) ? fp.GetInt32() : 15;
                StartWebRtcStream(fps);
                break;
            case "webrtc_stream_stop":
                webRtcDesktop.Stop();
                break;
        }
    }

    private void StartWebRtcStream(int fps)
    {
        if (_ws is not { State: WebSocketState.Open }) return;
        webRtcDesktop.Start(
            async (json) =>
            {
                if (_ws is { State: WebSocketState.Open })
                    await _ws.SendAsync(Encoding.UTF8.GetBytes(json), WebSocketMessageType.Text, true, CancellationToken.None);
            },
            fps,
            82);
    }

    private Task HandleWebRtcSignalAsync(JsonElement root, CancellationToken ct)
    {
        if (!root.TryGetProperty("payload", out var payload)) return Task.CompletedTask;
        var action = payload.TryGetProperty("action", out var a) ? a.GetString() : null;
        if (action == "start" || payload.TryGetProperty("sdp", out _))
        {
            var fps = payload.TryGetProperty("fps", out var f) ? f.GetInt32() : 15;
            StartWebRtcStream(fps);
        }
        if (action == "stop") webRtcDesktop.Stop();
        return Task.CompletedTask;
    }

    private async Task SendProcessListAsync(CancellationToken ct)
    {
        if (_ws is not { State: WebSocketState.Open }) return;
        var processes = watchdog.GetProcessList();
        var ev = JsonSerializer.Serialize(new
        {
            type = "event",
            payload = new { type = "process_list", processes },
        });
        await _ws.SendAsync(Encoding.UTF8.GetBytes(ev), WebSocketMessageType.Text, true, ct);
    }

    private async Task StreamLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var b64 = screenshots.CaptureJpegBase64();
            if (b64 != null && _ws is { State: WebSocketState.Open })
            {
                var ev = JsonSerializer.Serialize(new
                {
                    type = "event",
                    payload = new { type = "stream_frame", dataBase64 = b64 },
                });
                await _ws.SendAsync(Encoding.UTF8.GetBytes(ev), WebSocketMessageType.Text, true, ct);
            }
            await Task.Delay(_streamDelayMs, ct);
        }
    }

    private async Task SendScreenshotAsync(CancellationToken ct)
    {
        var b64 = screenshots.CaptureJpegBase64();
        if (b64 == null || _jwt == null) return;
        using var req = new HttpRequestMessage(HttpMethod.Post, "api/agent/screenshot");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _jwt);
        req.Content = JsonContent.Create(new { dataBase64 = b64 });
        await _http.SendAsync(req, ct);
    }
}
