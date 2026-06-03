using System.Drawing;
using System.Drawing.Imaging;

namespace Duster.Agent.Services;

public sealed class ScreenshotService(ILogger<ScreenshotService> logger)
{
    public string? CaptureJpegBase64(long quality = 60, double scale = 1.0)
    {
        try
        {
            var bounds = System.Windows.Forms.Screen.PrimaryScreen?.Bounds
                         ?? new Rectangle(0, 0, 1920, 1080);
            using var full = new Bitmap(bounds.Width, bounds.Height);
            using (var g = Graphics.FromImage(full))
                g.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
            var w = Math.Max(320, (int)(bounds.Width * scale));
            var h = Math.Max(240, (int)(bounds.Height * scale));
            using var bmp = new Bitmap(w, h);
            using (var g2 = Graphics.FromImage(bmp))
            {
                g2.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g2.DrawImage(full, 0, 0, w, h);
            }
            using var ms = new MemoryStream();
            var encoder = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
            var encParams = new EncoderParameters(1);
            encParams.Param[0] = new EncoderParameter(Encoder.Quality, quality);
            bmp.Save(ms, encoder, encParams);
            return Convert.ToBase64String(ms.ToArray());
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Screenshot failed");
            return null;
        }
    }
}
