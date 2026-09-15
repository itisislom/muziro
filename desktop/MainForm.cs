using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Muziro;

public class MainForm : Form
{
    private WebView2? _webView;
    private string _assetsPath = string.Empty;

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19;
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

    public MainForm()
    {
        InitializeWindow();
        InitializeAssets();
        _ = InitializeWebViewAsync();
    }

    private void InitializeWindow()
    {
        Text = "Muziro - Digital Audio Workstation";
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(1440, 900);
        MinimumSize = new Size(1024, 640);
        BackColor = Color.FromArgb(14, 14, 14);

        // Load Icon from local file or embedded resource
        try
        {
            string iconPath = Path.Combine(AppContext.BaseDirectory, "Muziro.ico");
            if (!File.Exists(iconPath))
            {
                iconPath = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "Muziro.ico");
            }
            if (File.Exists(iconPath))
            {
                Icon = new Icon(iconPath);
            }
            else
            {
                using var iconStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Muziro.ico");
                if (iconStream != null)
                {
                    Icon = new Icon(iconStream);
                }
            }
        }
        catch
        {
            // Fall back to default window icon
        }

        // Apply Windows 10/11 Dark Title Bar
        EnableDarkTitleBar();
    }

    private void EnableDarkTitleBar()
    {
        try
        {
            int useImmersiveDarkMode = 1;
            if (DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref useImmersiveDarkMode, sizeof(int)) != 0)
            {
                DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1, ref useImmersiveDarkMode, sizeof(int));
            }
        }
        catch
        {
            // Ignore if DWM is unavailable
        }
    }

    private void InitializeAssets()
    {
        // 1. Try "wwwroot" subdirectory in application directory
        string candidate1 = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        if (File.Exists(Path.Combine(candidate1, "index.html")))
        {
            _assetsPath = Path.GetFullPath(candidate1);
            return;
        }

        // 2. Try application base directory itself
        string candidate2 = AppContext.BaseDirectory;
        if (File.Exists(Path.Combine(candidate2, "index.html")))
        {
            _assetsPath = Path.GetFullPath(candidate2);
            return;
        }

        // 3. Try project root directory (during development / debugging)
        string candidate3 = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
        if (File.Exists(Path.Combine(candidate3, "index.html")))
        {
            _assetsPath = candidate3;
            return;
        }

        // 4. Extract embedded resources to LocalApplicationData for standalone executable
        try
        {
            string fallbackDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Muziro",
                "AppAssets"
            );
            Directory.CreateDirectory(fallbackDir);
            ExtractEmbeddedAssets(fallbackDir);
            if (File.Exists(Path.Combine(fallbackDir, "index.html")))
            {
                _assetsPath = fallbackDir;
                return;
            }
        }
        catch
        {
            // Ignore and fallback
        }

        _assetsPath = AppContext.BaseDirectory;
    }

    private void ExtractEmbeddedAssets(string targetDir)
    {
        var asm = Assembly.GetExecutingAssembly();
        string[] resourceNames = asm.GetManifestResourceNames();
        foreach (string res in resourceNames)
        {
            string relativePath = res.Replace('/', Path.DirectorySeparatorChar).Replace('\\', Path.DirectorySeparatorChar);
            string destFile = Path.Combine(targetDir, relativePath);
            string? destDir = Path.GetDirectoryName(destFile);
            if (!string.IsNullOrEmpty(destDir))
            {
                Directory.CreateDirectory(destDir);
            }

            using var stream = asm.GetManifestResourceStream(res);
            if (stream != null)
            {
                using var fileStream = new FileStream(destFile, FileMode.Create, FileAccess.Write);
                stream.CopyTo(fileStream);
            }
        }
    }

    private async Task InitializeWebViewAsync()
    {
        _webView = new WebView2
        {
            Dock = DockStyle.Fill,
            DefaultBackgroundColor = Color.FromArgb(14, 14, 14)
        };

        Controls.Add(_webView);

        try
        {
            // Persistent storage for IndexedDB (MuziroDB) and LocalStorage across sessions
            string userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Muziro",
                "WebView2Data"
            );
            Directory.CreateDirectory(userDataFolder);

            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await _webView.EnsureCoreWebView2Async(env);

            // Configure modern DAW viewport settings
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = true; // Support F12 debugging
            _webView.CoreWebView2.Settings.IsZoomControlEnabled = false; // Timeline uses custom wheel zoom

            // Map local files to offline HTTPS domain (allows full IndexedDB, Web Audio, and cross-frame postMessage)
            _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "muziro.local",
                _assetsPath,
                CoreWebView2HostResourceAccessKind.Allow
            );

            // Navigate to main entry point
            _webView.CoreWebView2.Navigate("https://muziro.local/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Failed to initialize Muziro Audio Engine WebView2:\n\n{ex.Message}\n\nAssets path: {_assetsPath}",
                "Muziro Initialization Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _webView?.Dispose();
        }
        base.Dispose(disposing);
    }
}
