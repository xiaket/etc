local M = {}

local DEFAULTS = {
  endpoint = "https://api.openai.com/v1/responses",
  model = "gpt-6-luna",
  max_output_tokens = 4096,
  temperature = nil, -- nil = don't send it; reasoning models may reject this param anyway
  system_prompt = "直接回答问题，不要客套，不要重复问题，能简洁就简洁。",
  enable_web_search = true, -- OpenAI Responses API only
  timeout = 10, -- seconds
}

local DEEPSEEK_DEFAULTS = {
  provider = "deepseek",
  endpoint = "https://api.deepseek.com/chat/completions",
  model = "deepseek-flash",
  max_output_tokens = 4096,
  system_prompt = DEFAULTS.system_prompt,
  timeout = DEFAULTS.timeout,
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

local function readKeyFromFile(path, name)
  local f = io.open(path, "r")
  if not f then
    return nil
  end
  local content = f:read("*a")
  f:close()
  return content:match(name .. '%s*=%s*"([^"]+)"')
    or content:match(name .. "%s*=%s*'([^']+)'")
    or content:match(name .. "%s*=%s*([^%s\"']+)")
end

local function getKey(name)
  local key = os.getenv(name)
  if key and #key > 0 then
    return key
  end
  for _, path in ipairs(SECRET_FILE_PATHS) do
    key = readKeyFromFile(path, name)
    if key and #key > 0 then
      return key
    end
  end
  return nil
end

-- Prefer OpenAI when both keys are configured; otherwise use DeepSeek.
function M.getProviderConfig()
  local cfg = M.get()
  local openaiKey = getKey("OPENAI_API_KEY")
  if openaiKey then
    cfg.provider = "openai"
    return cfg, openaiKey
  end

  local deepseekKey = getKey("DEEPSEEK_API_KEY")
  if deepseekKey then
    for k, v in pairs(DEEPSEEK_DEFAULTS) do
      cfg[k] = v
    end
    return cfg, deepseekKey
  end
  return nil, nil, "未找到 OPENAI_API_KEY 或 DEEPSEEK_API_KEY"
end

function M.getApiKey()
  local _, key, err = M.getProviderConfig()
  return key, err
end

return M
