using Duster.Agent;
using Duster.Agent.Services;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(options => { options.ServiceName = "DusterAgent"; });
builder.Services.AddHttpClient();
builder.Services.AddSingleton(sp => AgentConfig.From(sp.GetRequiredService<IConfiguration>()));
builder.Services.AddSingleton<MachineControl>();
builder.Services.AddSingleton<ScreenshotService>();
builder.Services.AddSingleton<H264EncoderService>();
builder.Services.AddSingleton<SessionCleanupService>();
builder.Services.AddSingleton<UsbPolicyService>();
builder.Services.AddSingleton<OfflineCacheService>();
builder.Services.AddSingleton<AutoUpdateService>();
builder.Services.AddSingleton<HardwareTelemetryService>();
builder.Services.AddSingleton<ProcessWatchdog>();
builder.Services.AddSingleton<WebRtcDesktopService>();
builder.Services.AddSingleton<ServerConnection>();
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
