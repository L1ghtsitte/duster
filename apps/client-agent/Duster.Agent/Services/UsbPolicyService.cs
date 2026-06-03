using Microsoft.Win32;

namespace Duster.Agent.Services;

/// <summary>
/// Блокировка USB-накопителей через реестр (требует перезагрузки политики или прав админа).
/// </summary>
public sealed class UsbPolicyService(ILogger<UsbPolicyService> logger)
{
    private const string StorageKey =
        @"SYSTEM\CurrentControlSet\Services\USBSTOR";

    public void Apply(bool blockStorage, bool allowCharge)
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(StorageKey, true)
                            ?? Registry.LocalMachine.CreateSubKey(StorageKey);
            if (key == null) return;
            if (blockStorage)
                key.SetValue("Start", 4, RegistryValueKind.DWord);
            else
                key.SetValue("Start", 3, RegistryValueKind.DWord);
            logger.LogInformation("USB storage policy: block={Block} charge={Charge}", blockStorage, allowCharge);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "USB policy requires administrator rights");
        }
    }
}
