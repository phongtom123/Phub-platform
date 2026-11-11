param(
    [string]$OutputPath = (Join-Path $PSScriptRoot 'PHUB-NGUOI-2.drawio')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Add-Attribute {
    param([System.Xml.XmlElement]$Element, [string]$Name, [string]$Value)
    $Element.SetAttribute($Name, $Value)
}

function Add-Cell {
    param(
        [System.Xml.XmlDocument]$Document,
        [System.Xml.XmlElement]$Root,
        [string]$Id,
        [string]$Value,
        [string]$Style,
        [double]$X,
        [double]$Y,
        [double]$Width,
        [double]$Height,
        [switch]$Edge,
        [string]$Source = '',
        [string]$Target = '',
        [switch]$Relative,
        [hashtable]$ExtraAttributes
    )

    $cell = $Document.CreateElement('mxCell')
    Add-Attribute $cell 'id' $Id
    if ($Value) { Add-Attribute $cell 'value' $Value }
    if ($Style) { Add-Attribute $cell 'style' $Style }
    Add-Attribute $cell 'parent' '1'
    if ($Edge) {
        Add-Attribute $cell 'edge' '1'
        if ($Source) { Add-Attribute $cell 'source' $Source }
        if ($Target) { Add-Attribute $cell 'target' $Target }
    } else {
        Add-Attribute $cell 'vertex' '1'
    }
    if ($ExtraAttributes) {
        foreach ($entry in $ExtraAttributes.GetEnumerator()) {
            Add-Attribute $cell ([string]$entry.Key) ([string]$entry.Value)
        }
    }

    $geometry = $Document.CreateElement('mxGeometry')
    if ($Edge -and $Relative) {
        Add-Attribute $geometry 'relative' '1'
    } else {
        Add-Attribute $geometry 'x' ([string]$X)
        Add-Attribute $geometry 'y' ([string]$Y)
        Add-Attribute $geometry 'width' ([string]$Width)
        Add-Attribute $geometry 'height' ([string]$Height)
    }
    Add-Attribute $geometry 'as' 'geometry'
    [void]$cell.AppendChild($geometry)
    [void]$Root.AppendChild($cell)
    return $cell
}

function Add-PointEdge {
    param(
        [System.Xml.XmlDocument]$Document,
        [System.Xml.XmlElement]$Root,
        [string]$Id,
        [string]$Value,
        [string]$Style,
        [double]$SourceX,
        [double]$SourceY,
        [double]$TargetX,
        [double]$TargetY,
        [object[]]$Points = @()
    )

    $cell = Add-Cell $Document $Root $Id $Value $Style 0 0 0 0 -Edge -Relative
    $geometry = $cell.SelectSingleNode('mxGeometry')
    $sourcePoint = $Document.CreateElement('mxPoint')
    Add-Attribute $sourcePoint 'x' ([string]$SourceX)
    Add-Attribute $sourcePoint 'y' ([string]$SourceY)
    Add-Attribute $sourcePoint 'as' 'sourcePoint'
    [void]$geometry.AppendChild($sourcePoint)
    $targetPoint = $Document.CreateElement('mxPoint')
    Add-Attribute $targetPoint 'x' ([string]$TargetX)
    Add-Attribute $targetPoint 'y' ([string]$TargetY)
    Add-Attribute $targetPoint 'as' 'targetPoint'
    [void]$geometry.AppendChild($targetPoint)
    if ($Points.Count -gt 0) {
        $array = $Document.CreateElement('Array')
        Add-Attribute $array 'as' 'points'
        foreach ($point in $Points) {
            $mxPoint = $Document.CreateElement('mxPoint')
            Add-Attribute $mxPoint 'x' ([string]$point.X)
            Add-Attribute $mxPoint 'y' ([string]$point.Y)
            [void]$array.AppendChild($mxPoint)
        }
        [void]$geometry.AppendChild($array)
    }
    return $cell
}

function New-GraphModel {
    param([System.Xml.XmlDocument]$Document, [double]$PageWidth, [double]$PageHeight)
    $model = $Document.CreateElement('mxGraphModel')
    foreach ($attribute in @{
        dx = '1422'; dy = '794'; grid = '1'; gridSize = '10'; guides = '1'; tooltips = '1'
        connect = '1'; arrows = '1'; fold = '1'; page = '1'; pageScale = '1'
        pageWidth = [string][Math]::Ceiling($PageWidth); pageHeight = [string][Math]::Ceiling($PageHeight)
        math = '0'; shadow = '0'
    }.GetEnumerator()) {
        Add-Attribute $model ([string]$attribute.Key) ([string]$attribute.Value)
    }
    $root = $Document.CreateElement('root')
    $base = $Document.CreateElement('mxCell')
    Add-Attribute $base 'id' '0'
    [void]$root.AppendChild($base)
    $layer = $Document.CreateElement('mxCell')
    Add-Attribute $layer 'id' '1'
    Add-Attribute $layer 'parent' '0'
    [void]$root.AppendChild($layer)
    [void]$model.AppendChild($root)
    return $model
}

function Get-WorkflowNodeDefinitions {
    param([string[]]$Lines)
    $nodes = [ordered]@{}
    $patterns = @(
        @{ Regex = '(?<![A-Za-z0-9_])(?<id>[A-Za-z][A-Za-z0-9_]*)\s*\(\[(?<label>[^\]]+)\]\)'; Shape = 'terminal' },
        @{ Regex = '(?<![A-Za-z0-9_])(?<id>[A-Za-z][A-Za-z0-9_]*)\s*\[/(?<label>.*?)/\]'; Shape = 'input' },
        @{ Regex = '(?<![A-Za-z0-9_])(?<id>[A-Za-z][A-Za-z0-9_]*)\s*\{(?<label>[^}]+)\}'; Shape = 'decision' },
        @{ Regex = '(?<![A-Za-z0-9_])(?<id>[A-Za-z][A-Za-z0-9_]*)\s*\[(?<label>[^\]]+)\]'; Shape = 'process' }
    )
    foreach ($line in $Lines) {
        foreach ($pattern in $patterns) {
            foreach ($match in [regex]::Matches($line, $pattern.Regex)) {
                $id = $match.Groups['id'].Value
                if (-not $nodes.Contains($id)) {
                    $nodes[$id] = [pscustomobject]@{
                        Id = $id
                        Label = $match.Groups['label'].Value.Trim('"')
                        Shape = $pattern.Shape
                    }
                }
            }
        }
    }
    return $nodes
}

function Get-WorkflowEdges {
    param([string[]]$Lines)
    $edges = [System.Collections.Generic.List[object]]::new()
    foreach ($line in $Lines) {
        if ($line -notmatch '-->') { continue }
        $parts = $line.Trim() -split '\s*-->\s*', 2
        if ($parts.Count -ne 2) { continue }
        if ($parts[0] -notmatch '^([A-Za-z][A-Za-z0-9_]*)') { continue }
        $source = $Matches[1]
        $right = $parts[1]
        $label = ''
        if ($right -match '^\|([^|]+)\|\s*(.*)$') {
            $label = $Matches[1].Trim('"')
            $right = $Matches[2]
        }
        if ($right -notmatch '^([A-Za-z][A-Za-z0-9_]*)') { continue }
        $edges.Add([pscustomobject]@{ Source = $source; Target = $Matches[1]; Label = $label })
    }
    return $edges
}

function Get-WorkflowCoordinates {
    param([string]$SvgPath, [System.Collections.IDictionary]$Nodes)
    [xml]$svg = Get-Content -Raw -Encoding UTF8 -LiteralPath $SvgPath
    $coordinates = @{}
    $groups = $svg.SelectNodes("//*[contains(concat(' ', normalize-space(@class), ' '), ' node ')]")
    foreach ($node in $Nodes.Values) {
        $group = $groups | Where-Object { $_.id -match ('flowchart-' + [regex]::Escape($node.Id) + '-\d+$') } | Select-Object -First 1
        if ($null -eq $group -or $group.transform -notmatch 'translate\(([-0-9.]+),\s*([-0-9.]+)\)') {
            throw "Không tìm thấy tọa độ SVG cho node $($node.Id) trong $SvgPath"
        }
        $coordinates[$node.Id] = [pscustomobject]@{ X = [double]$Matches[1]; Y = [double]$Matches[2] }
    }
    return $coordinates
}

function Add-WorkflowPage {
    param(
        [System.Xml.XmlDocument]$Document,
        [System.Xml.XmlElement]$Diagram,
        [string]$SourcePath,
        [string]$SvgPath
    )
    $lines = Get-Content -Encoding UTF8 -LiteralPath $SourcePath
    $nodes = Get-WorkflowNodeDefinitions $lines
    $edges = Get-WorkflowEdges $lines
    $coordinates = Get-WorkflowCoordinates $SvgPath $nodes

    $maxX = ($coordinates.Values | Measure-Object X -Maximum).Maximum + 220
    $maxY = ($coordinates.Values | Measure-Object Y -Maximum).Maximum + 140
    $model = New-GraphModel $Document ([Math]::Max(850, $maxX)) ([Math]::Max(1100, $maxY))
    $root = $model.SelectSingleNode('root')
    $idMap = @{}
    $counter = 2

    foreach ($node in $nodes.Values) {
        $coord = $coordinates[$node.Id]
        $width = 220.0
        $height = 54.0
        $style = 'rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;fontColor=#000000;fontSize=14;align=center;verticalAlign=middle;'
        switch ($node.Shape) {
            'terminal' {
                $width = [Math]::Max(120, [Math]::Min(220, 70 + $node.Label.Length * 7))
                $height = 50
                $style = 'rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;fontColor=#000000;fontSize=14;align=center;verticalAlign=middle;'
            }
            'input' {
                $width = [Math]::Max(220, [Math]::Min(310, 70 + $node.Label.Length * 7))
                $height = 60
                $style = 'shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;fontColor=#000000;fontSize=14;align=center;verticalAlign=middle;'
            }
            'decision' {
                $width = [Math]::Max(150, [Math]::Min(210, 90 + $node.Label.Length * 5))
                $height = $width * 0.62
                $style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;fontColor=#000000;fontSize=14;align=center;verticalAlign=middle;spacing=8;'
            }
            default {
                $width = [Math]::Max(220, [Math]::Min(320, 70 + $node.Label.Length * 7))
            }
        }
        $cellId = 'n' + $counter
        $counter++
        $idMap[$node.Id] = $cellId
        [void](Add-Cell $Document $root $cellId $node.Label $style ($coord.X - $width / 2 + 40) ($coord.Y - $height / 2 + 40) $width $height)
    }

    foreach ($edge in $edges) {
        if (-not $idMap.ContainsKey($edge.Source) -or -not $idMap.ContainsKey($edge.Target)) { continue }
        $edgeId = 'e' + $counter
        $counter++
        $style = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=1;strokeColor=#000000;fontColor=#000000;fontSize=13;labelBackgroundColor=#ffffff;'
        [void](Add-Cell $Document $root $edgeId $edge.Label $style 0 0 0 0 -Edge -Source $idMap[$edge.Source] -Target $idMap[$edge.Target] -Relative)
    }
    [void]$Diagram.AppendChild($model)
}

function Add-SequencePage {
    param(
        [System.Xml.XmlDocument]$Document,
        [System.Xml.XmlElement]$Diagram,
        [string]$SourcePath
    )
    $lines = Get-Content -Encoding UTF8 -LiteralPath $SourcePath
    $participants = [System.Collections.Generic.List[object]]::new()
    foreach ($line in $lines) {
        if ($line.Trim() -match '^(actor|participant)\s+([A-Za-z][A-Za-z0-9_]*)\s+as\s+(.+)$') {
            $participants.Add([pscustomobject]@{ Kind = $Matches[1]; Id = $Matches[2]; Label = $Matches[3].Trim() })
        }
    }

    $participantX = @{}
    for ($i = 0; $i -lt $participants.Count; $i++) {
        $participantX[$participants[$i].Id] = 130 + $i * 245
    }

    $messages = [System.Collections.Generic.List[object]]::new()
    $frames = [System.Collections.Generic.List[object]]::new()
    $separators = [System.Collections.Generic.List[object]]::new()
    $stack = [System.Collections.Generic.Stack[object]]::new()
    $y = 150.0
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed -match '^(alt|opt|loop|par|critical|break)\s+(.+)$') {
            $frame = [pscustomobject]@{ Kind = $Matches[1]; Label = $Matches[2]; StartY = $y - 18; EndY = 0.0; Depth = $stack.Count }
            $frames.Add($frame)
            $stack.Push($frame)
            $y += 30
            continue
        }
        if ($trimmed -match '^(else|and|option)\s*(.*)$') {
            $separators.Add([pscustomobject]@{ Label = ($Matches[1] + ' ' + $Matches[2]).Trim(); Y = $y; Depth = $stack.Count })
            $y += 30
            continue
        }
        if ($trimmed -eq 'end') {
            if ($stack.Count -gt 0) {
                $frame = $stack.Pop()
                $frame.EndY = $y + 10
            }
            $y += 18
            continue
        }
        if ($trimmed -match '^([A-Za-z][A-Za-z0-9_]*)(-->>|->>|-->|->|-\)|--)\s*([A-Za-z][A-Za-z0-9_]*):\s*(.+)$') {
            $messages.Add([pscustomobject]@{
                Source = $Matches[1]; Arrow = $Matches[2]; Target = $Matches[3]; Label = $Matches[4]; Y = $y
            })
            $y += if ($Matches[1] -eq $Matches[3]) { 62 } else { 46 }
        }
    }
    while ($stack.Count -gt 0) {
        $frame = $stack.Pop()
        $frame.EndY = $y + 10
    }

    $pageWidth = [Math]::Max(1600, 260 + $participants.Count * 245)
    $pageHeight = [Math]::Max(1100, $y + 100)
    $model = New-GraphModel $Document $pageWidth $pageHeight
    $root = $model.SelectSingleNode('root')
    $counter = 2
    $frameLeft = 40.0
    $frameRight = 130 + ($participants.Count - 1) * 245 + 130

    foreach ($frame in $frames) {
        $indent = $frame.Depth * 14
        $style = 'rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;fontColor=#000000;align=left;verticalAlign=top;spacingTop=5;spacingLeft=8;fontStyle=1;'
        [void](Add-Cell $Document $root ('frame' + $counter) ($frame.Kind + ' ' + $frame.Label) $style ($frameLeft + $indent) $frame.StartY (($frameRight - $frameLeft) - 2 * $indent) ([Math]::Max(50, $frame.EndY - $frame.StartY)))
        $counter++
    }

    foreach ($separator in $separators) {
        $indent = [Math]::Max(0, ($separator.Depth - 1) * 14)
        [void](Add-PointEdge $Document $root ('sep' + $counter) '' 'endArrow=none;startArrow=none;dashed=1;strokeColor=#000000;' ($frameLeft + $indent) $separator.Y ($frameRight - $indent) $separator.Y)
        $counter++
        [void](Add-Cell $Document $root ('septxt' + $counter) $separator.Label 'text;html=1;strokeColor=none;fillColor=#ffffff;align=left;verticalAlign=middle;fontStyle=1;fontSize=12;' ($frameLeft + $indent + 8) ($separator.Y - 13) 210 26)
        $counter++
    }

    foreach ($participant in $participants) {
        $x = $participantX[$participant.Id]
        if ($participant.Kind -eq 'actor') {
            [void](Add-Cell $Document $root ('p' + $counter) $participant.Label 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;fillColor=#ffffff;strokeColor=#000000;fontColor=#000000;fontSize=14;' ($x - 25) 25 50 75)
        } else {
            [void](Add-Cell $Document $root ('p' + $counter) $participant.Label 'rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;fontColor=#000000;fontSize=14;fontStyle=1;' ($x - 82) 30 164 54)
        }
        $counter++
        [void](Add-PointEdge $Document $root ('life' + $counter) '' 'endArrow=none;startArrow=none;dashed=1;dashPattern=4 4;strokeColor=#000000;' $x 110 $x ($y + 20))
        $counter++
    }

    foreach ($message in $messages) {
        if (-not $participantX.ContainsKey($message.Source) -or -not $participantX.ContainsKey($message.Target)) { continue }
        $sourceX = [double]$participantX[$message.Source]
        $targetX = [double]$participantX[$message.Target]
        $dashed = if ($message.Arrow.StartsWith('--')) { '1' } else { '0' }
        $endArrow = if ($message.Arrow -in @('->', '-->')) { 'open' } else { 'block' }
        $style = "html=1;rounded=0;endArrow=$endArrow;endFill=1;dashed=$dashed;strokeColor=#000000;fontColor=#000000;fontSize=12;labelBackgroundColor=#ffffff;verticalAlign=bottom;"
        if ($sourceX -eq $targetX) {
            $loopX = $sourceX + 72
            $points = @([pscustomobject]@{ X = $loopX; Y = $message.Y }, [pscustomobject]@{ X = $loopX; Y = $message.Y + 28 })
            [void](Add-PointEdge $Document $root ('msg' + $counter) $message.Label ($style + 'edgeStyle=orthogonalEdgeStyle;') $sourceX $message.Y $sourceX ($message.Y + 28) $points)
        } else {
            [void](Add-PointEdge $Document $root ('msg' + $counter) $message.Label $style $sourceX $message.Y $targetX $message.Y)
        }
        $counter++
    }

    [void]$Diagram.AppendChild($model)
}

$document = [System.Xml.XmlDocument]::new()
$document.PreserveWhitespace = $false
$mxfile = $document.CreateElement('mxfile')
foreach ($attribute in @{
    host = 'Electron'; agent = 'PHUB editable diagram builder'; version = '28.2.8'; type = 'device'; compressed = 'false'
}.GetEnumerator()) {
    Add-Attribute $mxfile ([string]$attribute.Key) ([string]$attribute.Value)
}
[void]$document.AppendChild($mxfile)

$sources = @(
    Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'N2-W*.mmd' | Sort-Object Name
    Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'N2-S*.mmd' | Sort-Object Name
)

$pageIndex = 1
foreach ($source in $sources) {
    $diagram = $document.CreateElement('diagram')
    Add-Attribute $diagram 'id' ('phub-person2-' + $pageIndex.ToString('00'))
    Add-Attribute $diagram 'name' $source.BaseName
    Add-Attribute $diagram 'mermaidSource' (Get-Content -Raw -Encoding UTF8 -LiteralPath $source.FullName)
    if ($source.BaseName.StartsWith('N2-W')) {
        $svgPath = Join-Path (Join-Path $PSScriptRoot 'rendered') ($source.BaseName + '.svg')
        Add-WorkflowPage $document $diagram $source.FullName $svgPath
    } else {
        Add-SequencePage $document $diagram $source.FullName
    }
    [void]$mxfile.AppendChild($diagram)
    $pageIndex++
}

$settings = [System.Xml.XmlWriterSettings]::new()
$settings.Indent = $true
$settings.Encoding = [System.Text.UTF8Encoding]::new($false)
$writer = [System.Xml.XmlWriter]::Create($OutputPath, $settings)
try {
    $document.Save($writer)
} finally {
    $writer.Dispose()
}

Write-Output "Đã tạo $($sources.Count) trang editable tại $OutputPath"
