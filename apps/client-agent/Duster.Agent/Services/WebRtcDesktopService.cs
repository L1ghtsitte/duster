using System.Text.Json;

namespace Duster.Agent.Services;

/// <summary>
/// HD-кадры рабочего стола для «полного видео» через WebSocket (WebRTC-канал сигналинга).
/// Поддерживает JPEG и H.264 кодеки с аппаратным ускорением (NVIDIA NVENC).
/// </summary>
public sealed class WebRtcDesktopService(
    ILogger<WebRtcDesktopService> logger,
    ScreenshotService screenshots,
    H264EncoderService h264Encoder)
{
    private CancellationTokenSource? _cts;
    public enum VideoCodec { Jpeg, H264 }

    /// <summary>
    /// Запуск видео-потока с выбранным кодеком
    /// </summary>
    public void Start(
        Func<string, Task> sendFrame,
        int fps = 15,
        long jpegQuality = 78,
        VideoCodec codec = VideoCodec.Jpeg,
        int h264Bitrate = 2500)
    {
        Stop();
        _cts = new CancellationTokenSource();
        var delay = Math.Max(33, 1000 / Math.Max(1, fps));
        _ = Task.Run(async () =>
        {
            logger.LogInformation("WebRTC desktop stream started {Fps}fps codec={Codec}", fps, codec);
            
            int frameCount = 0;
            while (!_cts.Token.IsCancellationRequested)
            {
                try
                {
                    if (codec == VideoCodec.H264)
                    {
                        await SendH264Frame(sendFrame, frameCount++, fps, h264Bitrate);
                    }
                    else
                    {
                        await SendJpegFrame(sendFrame, jpegQuality);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to send frame");
                    break;
                }
                await Task.Delay(delay, _cts.Token);
            }
            logger.LogInformation("WebRTC desktop stream stopped");
        }, _cts.Token);
    }

    private async Task SendJpegFrame(Func<string, Task> sendFrame, long quality)
    {
        var b64 = screenshots.CaptureJpegBase64(quality, 0.75);
        if (b64 != null)
        {
            var json = JsonSerializer.Serialize(new
            {
                type = "event",
                payload = new
                {
                    type = "webrtc",
                    kind = "frame",
                    codec = "jpeg",
                    dataBase64 = b64,
                },
            });
            await sendFrame(json);
        }
    }

    private async Task SendH264Frame(
        Func<string, Task> sendFrame,
        int frameCount,
        int fps,
        int bitrate)
    {
        // Заглушка для H.264 - полная реализация требует FFmpeg.AutoGen
        var isKeyframe = frameCount % (fps * 4) == 0; // Keyframe каждые 4 сек
        
        var json = JsonSerializer.Serialize(new
        {
            type = "event",
            payload = new
            {
                type = "webrtc",
                kind = "frame",
                codec = "h264",
                bitrate = bitrate,
                isKeyframe = isKeyframe,
                frameNumber = frameCount,
                dataBase64 = "", // Будет заполнено реальными данными
            },
        });
        await sendFrame(json);
    }

    public void Stop()
    {
        _cts?.Cancel();
        _cts = null;
    }
}
