param(
  [string]$Db = "mqww202512.accdb",
  [string]$Out = "tmp/mqww-female-poets.csv"
)

$ErrorActionPreference = "Stop"
$dbPath = (Resolve-Path $Db).Path
$dir = Split-Path -Parent $Out
if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

$connectionString = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Mode=Read"
$conn = New-Object System.Data.OleDb.OleDbConnection($connectionString)
$conn.Open()
try {
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = "SELECT poetID, NameHZ, Sex, StartYear, EndYear, ZiHZ, HaoHZ FROM poet WHERE Sex=?"
  $cmd.Parameters.Add("@sex", [System.Data.OleDb.OleDbType]::VarWChar, 10).Value = [string][char]0x5973
  $adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
  $table = New-Object System.Data.DataTable
  [void]$adapter.Fill($table)
  $table | Export-Csv -Path $Out -NoTypeInformation -Encoding UTF8
  "rows=$($table.Rows.Count) out=$Out"
}
finally {
  $conn.Close()
}
