using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using EnvDTE;
using Microsoft.VisualStudio.Shell;
using Task = System.Threading.Tasks.Task;

namespace CommitKingdom.VisualStudio
{
    /// <summary>
    /// Commit Kingdom Tracker for Visual Studio 2022 and later (ADR-024): reports coding to tudi-cli, which strips
    /// everything private before anything leaves the computer; the extension never reads file contents. Signing in
    /// belongs to Commit Kingdom Desktop (ADR-027), which also installs this extension and tudi-cli.
    /// The Visual Studio events and the language mapping are adapted from wakatime/visualstudio-wakatime (BSD-3, see
    /// LICENSE).
    /// </summary>
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [Guid(PackageGuid)]
    // Loads in the background once a solution, or any folder, is open; coding outside both is rare.
    [ProvideAutoLoad(Microsoft.VisualStudio.Shell.Interop.UIContextGuids80.NoSolution, PackageAutoLoadFlags.BackgroundLoad)]
    [ProvideAutoLoad(Microsoft.VisualStudio.Shell.Interop.UIContextGuids80.SolutionExists, PackageAutoLoadFlags.BackgroundLoad)]
    public sealed class TrackerPackage : AsyncPackage
    {
        public const string PackageGuid = "8d0f3c41-6b1e-4f7a-9c52-1e4a7b9d2c60";
        private const string Version = "0.1.0";

        private readonly HeartbeatGate _gate = new HeartbeatGate();
        private readonly LineCounter _lines = new LineCounter();
        private DTE _dte;
        // The event objects must be kept, or COM drops the handlers.
        private DocumentEvents _documentEvents;
        private WindowEvents _windowEvents;
        private TextEditorEvents _textEditorEvents;
        private BuildEvents _buildEvents;
        private bool _building;
        private bool _signedIn;
        private DateTime _signedInCheckedAt = DateTime.MinValue;

        protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
            _dte = await GetServiceAsync(typeof(DTE)) as DTE;
            if (_dte == null) return;

            _documentEvents = _dte.Events.DocumentEvents;
            _windowEvents = _dte.Events.WindowEvents;
            _textEditorEvents = _dte.Events.TextEditorEvents;
            _buildEvents = _dte.Events.BuildEvents;

            _documentEvents.DocumentSaved += document => Beat(document, true);
            _windowEvents.WindowActivated += (gotFocus, lostFocus) => Beat(SafeDocument(gotFocus), false);
            _textEditorEvents.LineChanged += (start, end, hint) => Beat(start?.Parent?.Parent, false);
            _buildEvents.OnBuildBegin += (scope, action) => _building = true;
            _buildEvents.OnBuildDone += (scope, action) => _building = false;
        }

        private void Beat(Document document, bool isWrite)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                if (document == null || !SignedIn()) return;
                var file = document.FullName;
                if (string.IsNullOrEmpty(file) || !File.Exists(file)) return;
                if (!_gate.ShouldSend(file, isWrite, DateTime.UtcNow)) return;

                var lines = LineCount(document);
                var args = new List<string>
                {
                    "--entity", file,
                    "--plugin", $"visualstudio/{_dte.Version} tudi-visualstudio/{Version}",
                    "--category", Category(),
                    // Lines gather between heartbeats and go with the next one for this file.
                    "--human-line-changes", (lines == null ? 0 : _lines.Take(file, lines.Value)).ToString(),
                };
                if (isWrite) args.Add("--write");
                if (lines != null) args.AddRange(new[] { "--lines-in-file", lines.Value.ToString() });
                var language = Language(document);
                if (!string.IsNullOrEmpty(language)) args.AddRange(new[] { "--alternate-language", language });
                // The project name is hashed on this computer before it leaves (cli/pkg/heartbeat/tudi_privacy.go).
                var solution = _dte.Solution?.FullName;
                if (!string.IsNullOrEmpty(solution)) args.AddRange(new[] { "--alternate-project", Path.GetFileNameWithoutExtension(solution) });
                Cli.Send(args);
            }
            catch (Exception)
            {
                // A heartbeat is never worth an error in the editor.
            }
        }

        /// <summary>Whether Commit Kingdom Desktop has signed this computer in; read again at most every 10 seconds.</summary>
        private bool SignedIn()
        {
            if (DateTime.UtcNow - _signedInCheckedAt > TimeSpan.FromSeconds(10))
            {
                _signedIn = Account.IsSignedIn();
                _signedInCheckedAt = DateTime.UtcNow;
            }
            return _signedIn;
        }

        private string Category()
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            if (_building) return "building";
            return _dte.Debugger?.CurrentMode == dbgDebugMode.dbgBreakMode ? "debugging" : "coding";
        }

        private static Document SafeDocument(Window window)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                return window?.Document;
            }
            catch (COMException)
            {
                return null;
            }
        }

        private static int? LineCount(Document document)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                return document.Object("TextDocument") is TextDocument text ? text.EndPoint.Line : (int?)null;
            }
            catch (COMException)
            {
                return null;
            }
        }

        /// <summary>Visual Studio's language ids where they differ from tudi-cli's names; tudi-cli's own detection comes first.</summary>
        private static string Language(Document document)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            string language;
            try
            {
                language = document.Language;
            }
            catch (COMException)
            {
                return null;
            }
            switch (language)
            {
                case "CSharp": return "C#";
                case "C/C++": return "C++";
                case "Basic": return "VB.NET";
                case "HTMLX":
                case "HTMLXProjection": return "HTML";
                case "Plain Text": return "Text";
                default:
                    return language != null && language.IndexOf("SQL", StringComparison.OrdinalIgnoreCase) >= 0 ? "SQL" : language;
            }
        }
    }
}
