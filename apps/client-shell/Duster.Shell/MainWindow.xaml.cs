using System.IO;
using System.Net.Http.Json;
using System.Text.Json;
using System.Windows;

namespace Duster.Shell;

public partial class MainWindow : Window
{
    private readonly HttpClient _http = new();
    private string? _token;
    private readonly int _pcNumber;
    private readonly string _serverUrl;

    public MainWindow()
    {
        InitializeComponent();
        _serverUrl = Environment.GetEnvironmentVariable("DUSTER_SERVER") ?? "http://127.0.0.1:3847";
        if (File.Exists(@"C:\Duster\server.url"))
            _serverUrl = File.ReadAllText(@"C:\Duster\server.url").Trim();
        _pcNumber = int.TryParse(Environment.GetEnvironmentVariable("DUSTER_PC"), out var n) ? n : 1;
        PcLabel.Text = $"Станция #{_pcNumber}";
        _http.BaseAddress = new Uri(_serverUrl.TrimEnd('/') + "/");
    }

    private async void LoginClick(object sender, RoutedEventArgs e)
    {
        StatusText.Text = "";
        try
        {
            var res = await _http.PostAsJsonAsync("api/station/login", new
            {
                computerNumber = _pcNumber,
                pin = PinBox.Password,
            });
            var json = await res.Content.ReadFromJsonAsync<JsonElement>();
            if (!res.IsSuccessStatusCode)
            {
                StatusText.Text = json.TryGetProperty("message", out var m) ? m.GetString() : "Ошибка входа";
                return;
            }
            _token = json.GetProperty("token").GetString();
            var name = json.GetProperty("player").GetProperty("displayName").GetString();
            SessionText.Text = $"Добро пожаловать, {name}!";
            LogoutBtn.Visibility = Visibility.Visible;
            GameHubBtn.Visibility = Visibility.Visible;
            PinBox.IsEnabled = false;
        }
        catch (Exception ex)
        {
            StatusText.Text = ex.Message;
        }
    }

    private async void LogoutClick(object sender, RoutedEventArgs e)
    {
        if (_token != null)
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, "api/station/logout");
            req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);
            await _http.SendAsync(req);
        }
        _token = null;
        SessionText.Text = "";
        LogoutBtn.Visibility = Visibility.Collapsed;
        GameHubBtn.Visibility = Visibility.Collapsed;
        PinBox.IsEnabled = true;
        PinBox.Clear();
    }

    private void GameHubClick(object sender, RoutedEventArgs e)
    {
        new GameHubWindow { Owner = this }.Show();
    }
}
