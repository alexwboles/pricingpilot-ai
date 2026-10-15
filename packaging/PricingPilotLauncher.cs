using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class PricingPilotLauncher {
    private static string FindEdge() {
        foreach (string folder in new[] { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) }) {
            if (String.IsNullOrEmpty(folder)) continue;
            string candidate = Path.Combine(folder, @"Microsoft\Edge\Application\msedge.exe");
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }
    [STAThread]
    private static int Main(string[] args) {
        bool check = args.Length == 1 && args[0] == "--check";
        try {
            if (args.Length > 0 && !check) throw new InvalidOperationException("Unsupported launch option.");
            string root = AppDomain.CurrentDomain.BaseDirectory;
            foreach (string file in new[] { "index.html", @"css\style.css", @"js\app.js", @"lib\logic.js", @"lib\backup.js", "USER-GUIDE.txt", "SETUP-NOTICE.txt" }) {
                if (!File.Exists(Path.Combine(root, file))) throw new FileNotFoundException("PricingPilot files are missing. Reinstall the complete review package. Missing: " + file);
            }
            string edge = FindEdge();
            if (edge == null) throw new InvalidOperationException("Microsoft Edge is required. This package does not download or install a browser. Contact TechPartner for setup help.");
            if (check) return 0;
            string url = new Uri(Path.Combine(root, "index.html")).AbsoluteUri;
            Process.Start(new ProcessStartInfo { FileName = edge, Arguments = "\"" + url + "\"", WorkingDirectory = root, UseShellExecute = false });
            return 0;
        } catch (Exception error) {
            if (!check) MessageBox.Show(error.Message, "PricingPilot setup help", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 1;
        }
    }
}
