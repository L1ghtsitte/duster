namespace Duster.Agent;

public sealed class AgentConfig
{
    public string ServerUrl { get; init; } = "http://127.0.0.1:3847";
    public string AgentToken { get; init; } = "";
    public int HeartbeatSeconds { get; init; } = 30;

    public static AgentConfig From(IConfiguration config)
    {
        var section = config.GetSection("Duster");
        return new AgentConfig
        {
            ServerUrl = section["ServerUrl"] ?? "http://127.0.0.1:3847",
            AgentToken = section["AgentToken"] ?? "",
            HeartbeatSeconds = int.TryParse(section["HeartbeatSeconds"], out var s) ? s : 30,
        };
    }
}
