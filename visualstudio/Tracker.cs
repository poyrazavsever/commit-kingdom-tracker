using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;

namespace CommitKingdom.VisualStudio
{
    /// <summary>
    /// Where tudi-cli and its config live (cli/pkg/ini), the way Commit Kingdom Desktop writes them
    /// (desktop/src/main/cliConfig.ts): TUDI_HOME (or WAKATIME_HOME) holds both; otherwise the config is
    /// <c>~/.tudi.cfg</c> and the CLI is <c>~/.tudi/tudi-cli.exe</c>.
    /// </summary>
    internal static class CliPaths
    {
        private static string Custom
        {
            get
            {
                var value = Environment.GetEnvironmentVariable("TUDI_HOME");
                if (string.IsNullOrEmpty(value)) value = Environment.GetEnvironmentVariable("WAKATIME_HOME");
                return string.IsNullOrEmpty(value) ? null : value;
            }
        }

        private static string Home => Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

        public static string Config => Path.Combine(Custom ?? Home, ".tudi.cfg");

        public static string Cli => Path.Combine(Custom ?? Path.Combine(Home, ".tudi"), "tudi-cli.exe");
    }

    /// <summary>
    /// Signing in belongs to Commit Kingdom Desktop (ADR-027): it writes the device key to tudi-cli's config. Until then
    /// the extension sends nothing.
    /// </summary>
    internal static class Account
    {
        public static bool IsSignedIn()
        {
            try
            {
                if (!File.Exists(CliPaths.Config) || !File.Exists(CliPaths.Cli)) return false;
                var section = "";
                foreach (var raw in File.ReadAllLines(CliPaths.Config))
                {
                    var line = raw.Trim();
                    if (line.StartsWith("[") && line.EndsWith("]")) section = line.Substring(1, line.Length - 2).Trim();
                    else if (section == "settings" && line.StartsWith("api_key"))
                    {
                        var equals = line.IndexOf('=');
                        if (equals > 0 && line.Substring(0, equals).Trim() == "api_key" && line.Substring(equals + 1).Trim().Length > 0) return true;
                    }
                }
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
            return false;
        }
    }

    /// <summary>
    /// When a change becomes a heartbeat: a save always does, switching to another file does, and typing in the same
    /// file does once every two minutes (the VS Code extension's gate, vscode/src/gate.ts).
    /// </summary>
    internal sealed class HeartbeatGate
    {
        public static readonly TimeSpan Repeat = TimeSpan.FromMinutes(2);
        private string _lastFile;
        private DateTime _lastAt = DateTime.MinValue;

        public bool ShouldSend(string file, bool isWrite, DateTime now)
        {
            var send = isWrite || !string.Equals(file, _lastFile, StringComparison.OrdinalIgnoreCase) || now - _lastAt >= Repeat;
            if (send)
            {
                _lastFile = file;
                _lastAt = now;
            }
            return send;
        }
    }

    /// <summary>
    /// The person's net line changes per file since that file's last heartbeat, from the file's line count. tudi-cli
    /// gets them as --human-line-changes so the server can tell a person's minutes from an AI tool's (ADR-024).
    /// </summary>
    internal sealed class LineCounter
    {
        private readonly Dictionary<string, int> _seen = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        public int Take(string file, int lines)
        {
            var delta = _seen.TryGetValue(file, out var before) ? lines - before : 0;
            _seen[file] = lines;
            return delta;
        }
    }

    /// <summary>Starts tudi-cli without a window and without waiting; it queues offline and strips everything private.</summary>
    internal static class Cli
    {
        public static void Send(IEnumerable<string> args)
        {
            try
            {
                var start = new ProcessStartInfo(CliPaths.Cli, string.Join(" ", args.Select(Quote)))
                {
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden,
                };
                using (Process.Start(start))
                {
                }
            }
            catch (Exception)
            {
                // tudi-cli missing or blocked: Commit Kingdom Desktop installs and updates it; the next heartbeat tries again.
            }
        }

        /// <summary>One Windows command-line argument (the rules CommandLineToArgvW reads).</summary>
        internal static string Quote(string argument)
        {
            if (argument.Length > 0 && argument.IndexOfAny(new[] { ' ', '\t', '"' }) < 0) return argument;
            var quoted = new StringBuilder("\"");
            var slashes = 0;
            foreach (var character in argument)
            {
                if (character == '\\')
                {
                    slashes++;
                    continue;
                }
                quoted.Append('\\', character == '"' ? slashes * 2 + 1 : slashes);
                slashes = 0;
                quoted.Append(character);
            }
            quoted.Append('\\', slashes * 2).Append('"');
            return quoted.ToString();
        }
    }
}
