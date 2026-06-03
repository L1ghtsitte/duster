using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace Duster.Agent.Services;

/// <summary>
/// Управление станцией: блокировка, выключение, перезагрузка.
/// Для production: shell replacement / Assigned Access / политики GPO.
/// </summary>
public sealed class MachineControl(ILogger<MachineControl> logger)
{
    public void Lock()
    {
        logger.LogInformation("Lock workstation");
        // Блокировка Win+L эквивалент
        LockWorkStation();
    }

    public void Shutdown(bool force)
    {
        logger.LogInformation("Shutdown force={Force}", force);
        Process.Start("shutdown", force ? "/s /f /t 0" : "/s /t 0");
    }

    public void Restart(bool force)
    {
        logger.LogInformation("Restart force={Force}", force);
        Process.Start("shutdown", force ? "/r /f /t 0" : "/r /t 0");
    }

    public void Logoff()
    {
        Process.Start("shutdown", "/l");
    }

    public void ShowMessage(string text)
    {
        MessageBox.Show(text, "Duster", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    [DllImport("user32.dll")]
    private static extern bool LockWorkStation();
}
