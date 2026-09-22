# Diagnostic: replicate the app's LLM call using the stored credential.
# The API key is read from Windows Credential Manager and is NEVER printed.
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class CredMan {
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern bool CredRead(string target, int type, int reserved, out IntPtr credPtr);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  private struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist;
    public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  public static string ReadSecret(string target) {
    IntPtr p;
    if (!CredRead(target, 1, 0, out p)) return null;
    try {
      CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
      byte[] blob = new byte[c.CredentialBlobSize];
      Marshal.Copy(c.CredentialBlob, blob, 0, c.CredentialBlobSize);
      // keyring (windows-native) stores the secret as UTF-16; fall back to UTF-8.
      string wide = System.Text.Encoding.Unicode.GetString(blob);
      if (wide.IndexOf('\u0000') >= 0 || wide.Length == 0) {
        string utf8 = System.Text.Encoding.UTF8.GetString(blob);
        if (utf8.IndexOf('\u0000') < 0) return utf8;
      }
      return wide;
    } finally { Marshal.FreeCoTaskMem(p); }
  }
}
'@

$key = [CredMan]::ReadSecret('llm-api-key.workforce-ai-analyst')
if (-not $key) { Write-Output 'RESULT: NO_KEY_FOUND'; exit 1 }
Write-Output ("KEY_LOADED length=" + $key.Length)

$body = @{
  model = 'glm-5.3-flash'
  messages = @(
    @{ role = 'system'; content = 'you are a helpful assistant' },
    @{ role = 'user'; content = 'Reply with exactly: OK' }
  )
  temperature = 0.1
} | ConvertTo-Json -Depth 5

$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $r = Invoke-RestMethod -Uri 'http://192.168.2.220:3000/v1/chat/completions' `
    -Method Post -Headers @{ Authorization = "Bearer $key" } `
    -ContentType 'application/json' -Body $body -TimeoutSec 180
  $sw.Stop()
  $content = $r.choices[0].message.content
  $reasoning = $r.choices[0].message.reasoning_content
  Write-Output ("RESULT: HTTP_OK in " + [int]$sw.Elapsed.TotalSeconds + "s")
  Write-Output ("MODEL_RETURNED: " + $r.model)
  Write-Output ("CONTENT_EMPTY: " + [string]::IsNullOrWhiteSpace($content))
  if (-not [string]::IsNullOrWhiteSpace($reasoning)) { Write-Output "HAS_REASONING_CONTENT: true" }
  Write-Output ("CONTENT_PREVIEW: " + ($content | Out-String).Trim().Substring(0, [Math]::Min(200, $content.Length)))
} catch {
  $sw.Stop()
  Write-Output ("RESULT: HTTP_ERROR in " + [int]$sw.Elapsed.TotalSeconds + "s")
  Write-Output ("ERROR: " + $_.Exception.Message)
  $resp = $_.Exception.Response
  if ($resp) {
    Write-Output ("HTTP_STATUS: " + [int]$resp.StatusCode)
    try {
      $stream = $resp.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $errBody = $reader.ReadToEnd()
      Write-Output ("BODY_PREVIEW: " + $errBody.Substring(0, [Math]::Min(400, $errBody.Length)))
    } catch { Write-Output 'BODY_PREVIEW: <unavailable>' }
  }
}
