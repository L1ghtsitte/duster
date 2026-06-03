using System.Diagnostics;
using System.IO;
using System.Windows;

namespace Duster.Shell;

public partial class GameHubWindow : Window
{
    private readonly List<GameEntry> _games = [];

    public GameHubWindow()
    {
        InitializeComponent();
        LoadGames();
    }

    private void LoadGames()
    {
        _games.Clear();
        ScanSteam();
        ScanEpic();
        ScanRiot();
        GamesList.ItemsSource = _games.Select(g => $"{g.Name}  [{g.Source}]").ToList();
        StatusText.Text = $"Найдено игр: {_games.Count}";
    }

    private void ScanSteam()
    {
        var paths = new[]
        {
            @"C:\Program Files (x86)\Steam\steamapps\common",
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Steam", "steamapps", "common"),
        };
        foreach (var p in paths.Distinct())
        {
            if (!Directory.Exists(p)) continue;
            foreach (var dir in Directory.GetDirectories(p))
            {
                var exe = Directory.GetFiles(dir, "*.exe", SearchOption.TopDirectoryOnly).FirstOrDefault();
                if (exe != null)
                    _games.Add(new GameEntry(Path.GetFileName(dir), exe, "Steam"));
            }
        }
    }

    private void ScanEpic()
    {
        var epic = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "Epic", "EpicGamesLauncher", "Data", "Manifests");
        if (!Directory.Exists(epic)) return;
        foreach (var json in Directory.GetFiles(epic, "*.item"))
        {
            var name = Path.GetFileNameWithoutExtension(json);
            _games.Add(new GameEntry(name, "com.epicgames.launcher://", "Epic"));
        }
    }

    private void ScanRiot()
    {
        var riot = @"C:\Riot Games";
        if (!Directory.Exists(riot)) return;
        var lol = Path.Combine(riot, "League of Legends", "LeagueClient.exe");
        if (File.Exists(lol)) _games.Add(new GameEntry("League of Legends", lol, "Riot"));
        var val = Path.Combine(riot, "VALORANT", "live", "VALORANT.exe");
        if (File.Exists(val)) _games.Add(new GameEntry("VALORANT", val, "Riot"));
    }

    private void PlayClick(object sender, RoutedEventArgs e)
    {
        if (GamesList.SelectedIndex < 0 || GamesList.SelectedIndex >= _games.Count) return;
        var g = _games[GamesList.SelectedIndex];
        try
        {
            Process.Start(new ProcessStartInfo(g.ExePath) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message);
        }
    }

    private record GameEntry(string Name, string ExePath, string Source);
}
