$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$config = Join-Path $root "mermaid-report-config.json"

$diagrams = @(
  "high-level-architecture",
  "fe-be-db-ai-data-flow"
)

foreach ($name in $diagrams) {
  $input = Join-Path $root "$name.mmd"
  $svg = Join-Path $root "$name.svg"
  $png = Join-Path $root "$name.png"

  npx.cmd -y @mermaid-js/mermaid-cli@10.9.1 -i $input -o $svg -c $config -b white
  npx.cmd -y @mermaid-js/mermaid-cli@10.9.1 -i $input -o $png -c $config -b white -s 2
}

Write-Host "Rendered Mermaid diagrams to SVG and PNG in $root"
