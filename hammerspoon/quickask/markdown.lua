-- Minimal, dependency-free Markdown -> HTML converter.
-- Supports: fenced code blocks, inline code, bold/italic, headers, lists,
-- links, paragraphs. Good enough for LLM chat answers, not a full parser.
local M = {}

local function escapeHtml(s)
  s = s:gsub("&", "&amp;")
  s = s:gsub("<", "&lt;")
  s = s:gsub(">", "&gt;")
  return s
end

local function inlineFormat(s)
  s = s:gsub("`([^`]+)`", "<code>%1</code>")
  s = s:gsub("%*%*(.-)%*%*", "<strong>%1</strong>")
  s = s:gsub("%*(.-)%*", "<em>%1</em>")
  s = s:gsub("%[(.-)%]%((.-)%)", '<a href="%2" target="_blank">%1</a>')
  return s
end

function M.toHTML(text)
  text = text or ""

  local lines = {}
  for line in (text .. "\n"):gmatch("(.-)\n") do
    table.insert(lines, line)
  end

  local html = {}
  local inCode = false
  local codeLines = {}
  local inList = false

  local function closeList()
    if inList then
      table.insert(html, "</ul>")
      inList = false
    end
  end

  local function flushCode()
    table.insert(html, "<pre><code>" .. escapeHtml(table.concat(codeLines, "\n")) .. "</code></pre>")
    codeLines = {}
  end

  for _, line in ipairs(lines) do
    local fence = line:match("^```")
    if fence then
      if inCode then
        inCode = false
        flushCode()
      else
        closeList()
        inCode = true
      end
    elseif inCode then
      table.insert(codeLines, line)
    else
      local heading, htext = line:match("^(#+)%s+(.*)$")
      if heading then
        closeList()
        local level = math.min(#heading, 6)
        table.insert(html, string.format("<h%d>%s</h%d>", level, inlineFormat(escapeHtml(htext)), level))
      else
        local bullet = line:match("^[%-%*]%s+(.*)$")
        if bullet then
          if not inList then
            table.insert(html, "<ul>")
            inList = true
          end
          table.insert(html, "<li>" .. inlineFormat(escapeHtml(bullet)) .. "</li>")
        elseif line:match("^%s*$") then
          closeList()
        else
          closeList()
          table.insert(html, "<p>" .. inlineFormat(escapeHtml(line)) .. "</p>")
        end
      end
    end
  end

  closeList()
  if inCode and #codeLines > 0 then
    flushCode()
  end

  return table.concat(html, "\n")
end

return M
