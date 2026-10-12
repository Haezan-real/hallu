using System;
using System.Diagnostics;
using System.IO;

namespace HalluLauncher
{
    internal static class Program
    {
        private static int Main(string[] args)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string binDir = Path.Combine(baseDir, "bin");
            string batPath = Path.Combine(binDir, "hallu_editor_dev.bat");

            if (!File.Exists(batPath))
            {
                Console.Error.WriteLine("Error: Could not find '" + batPath + "'");
                return 1;
            }

            string comSpec = Environment.GetEnvironmentVariable("ComSpec");
            if (string.IsNullOrEmpty(comSpec))
            {
                comSpec = "cmd.exe";
            }

            string cmdArgs = "/c \"\"" + batPath + "\"";
            if (args != null && args.Length > 0)
            {
                for (int i = 0; i < args.Length; i++)
                {
                    cmdArgs += " \"" + args[i].Replace("\"", "\\\"") + "\"";
                }
            }
            cmdArgs += "\"";

            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = comSpec,
                Arguments = cmdArgs,
                WorkingDirectory = binDir,
                UseShellExecute = false
            };

            try
            {
                using (Process proc = Process.Start(psi))
                {
                    if (proc == null)
                    {
                        Console.Error.WriteLine("Error: Unable to start command process.");
                        return 1;
                    }
                    proc.WaitForExit();
                    return proc.ExitCode;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Failed to launch Hallu dev editor: " + ex.Message);
                return 1;
            }
        }
    }
}
