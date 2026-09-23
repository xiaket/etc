local M = {}

local DEFAULTS = {
  endpoint = "https://api.openai.com/v1/responses",
  model = "gpt-6-luna",
  max_output_tokens = 4096,
  temperature = nil, -- nil = don't send it; reasoning models may reject this param anyway
  system_prompt = "直接回答问题，不要客套，不要重复问题，能简洁就简洁。",
  enable_web_search = true, -- turn off for a plain single-turn call without the web_search tool
  timeout = 10, -- seconds
}

-- Fallback sources for OPENAI_API_KEY when the GUI process doesn't see it
-- (Hammerspoon.app doesn't inherit shell-rc exports unless launchctl setenv was used).
-- Tried in order; first one that exists and has the key wins.
local HOME = os.getenv("HOME") or ""
local SECRET_FILE_PATHS = {
  HOME .. "/.xiaket/etc/bash_secrets",
  HOME .. "/.xiaket/alt/etc/bash_secrets",
}

function M.get()
  local cfg = {}
  for k, v in pairs(DEFAULTS) do
    cfg[k] = v
  end
  return cfg
end

local function readKeyFromFile(path)
  local f = io.open(path, "r")
  if not f then
    return nil
  end
  local content = f:read("*a")
  f:close()
  return content:match('OPENAI_API_KEY%s*=%s*"([^"]+)"')
    or content:match("OPENAI_API_KEY%s*=%s*'([^']+)'")
    or content:match("OPENAI_API_KEY%s*=%s*([^%s\"']+)")
end

function M.getApiKey()
  local key = os.getenv("OPENAI_API_KEY")
  if key and #key > 0 then
    return key
  end

  for _, path in ipairs(SECRET_FILE_PATHS) do
    key = readKeyFromFile(path)
    if key and #key > 0 then
      return key
    end
  end

  return nil, "未找到 OPENAI_API_KEY"
end

return M
