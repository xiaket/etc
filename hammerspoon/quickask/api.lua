local M = {}

local config = require("quickask.config")

-- Responses API wants plain text content as a bare string, but a multimodal
-- message needs content = {{type="input_text",...}, {type="input_image",...}}.
local function buildContent(text, images)
  if not images or #images == 0 then
    return text
  end
  local content = { { type = "input_text", text = text } }
  for _, dataUrl in ipairs(images) do
    table.insert(content, { type = "input_image", image_url = dataUrl })
  end
  return content
end

local function buildInputItems(turns, question, images)
  local items = {}
  for _, turn in ipairs(turns or {}) do
    table.insert(items, { role = "user", content = buildContent(turn.question, turn.images) })
    table.insert(items, { role = "assistant", content = turn.answer })
  end
  table.insert(items, { role = "user", content = buildContent(question, images) })
  return items
end

local function classifyError(status, body)
  if status == nil or status < 0 then
    return "网络连接失败，请检查网络"
  end

  local msg
  local ok, decoded = pcall(hs.json.decode, body or "")
  if ok and decoded and decoded.error and decoded.error.message then
    msg = decoded.error.message
  end

  if status == 401 then
    return "认证失败（401）：请检查 OPENAI_API_KEY 是否有效" .. (msg and (" — " .. msg) or "")
  elseif status == 429 then
    return "请求受限或额度不足（429）" .. (msg and (" — " .. msg) or "；请检查账号额度、项目预算和速率限制")
  elseif status >= 500 then
    return "OpenAI 服务端错误（" .. status .. "），请稍后再试"
  else
    return "API 错误（" .. tostring(status) .. "）" .. (msg and (" — " .. msg) or "")
  end
end

local function extractAnswer(decoded)
  local textParts = {}
  local citations = {}
  local seen = {}

  for _, item in ipairs(decoded.output or {}) do
    if item.type == "message" then
      for _, part in ipairs(item.content or {}) do
        if part.type == "output_text" then
          table.insert(textParts, part.text)
          for _, ann in ipairs(part.annotations or {}) do
            if ann.type == "url_citation" and ann.url and not seen[ann.url] then
              seen[ann.url] = true
              table.insert(citations, { title = ann.title or ann.url, url = ann.url })
            end
          end
        end
      end
    end
  end

  local answer = table.concat(textParts, "\n")
  if #citations > 0 then
    local lines = { "", "参考来源：" }
    for _, c in ipairs(citations) do
      table.insert(lines, string.format("- [%s](%s)", c.title, c.url))
    end
    answer = answer .. "\n" .. table.concat(lines, "\n")
  end
  return answer
end

-- turns: {{question=..., answer=..., images=...}, ...} prior Q&A in this same panel session
-- question: the current question text
-- images: {dataUrl, ...} optional data: URLs (e.g. "data:image/png;base64,...") pasted alongside it
-- cfg: config.get() table
-- onSuccess(answerText), onError(humanReadableMessage)
function M.ask(turns, question, images, cfg, onSuccess, onError)
  local providerCfg, apiKey, keyErr = config.getProviderConfig()
  if not apiKey then
    onError(keyErr)
    return
  end
  -- Keep the caller's prompt/timeout while taking provider-specific API defaults.
  providerCfg.system_prompt = cfg.system_prompt or providerCfg.system_prompt
  providerCfg.timeout = cfg.timeout or providerCfg.timeout
  cfg = providerCfg

  local body
  if cfg.provider == "deepseek" then
    local function chatContent(text, imageUrls)
      if not imageUrls or #imageUrls == 0 then
        return text
      end
      local content = { { type = "text", text = text } }
      for _, dataUrl in ipairs(imageUrls) do
        table.insert(content, { type = "image_url", image_url = { url = dataUrl } })
      end
      return content
    end
    local messages = { { role = "system", content = cfg.system_prompt } }
    for _, turn in ipairs(turns or {}) do
      table.insert(messages, { role = "user", content = chatContent(turn.question, turn.images) })
      table.insert(messages, { role = "assistant", content = turn.answer })
    end
    table.insert(messages, { role = "user", content = chatContent(question, images) })
    body = { model = cfg.model, messages = messages, max_tokens = cfg.max_output_tokens }
  else
    body = {
      model = cfg.model,
      instructions = cfg.system_prompt,
      input = buildInputItems(turns, question, images),
      max_output_tokens = cfg.max_output_tokens,
    }
    if cfg.temperature then
      body.temperature = cfg.temperature
    end
    if cfg.enable_web_search then
      body.tools = { { type = "web_search" } }
    end
  end

  local headers = {
    ["Content-Type"] = "application/json",
    ["Authorization"] = "Bearer " .. apiKey,
  }

  local done = false
  local timeoutTimer = hs.timer.doAfter(cfg.timeout, function()
    if done then
      return
    end
    done = true
    onError("请求超时（超过 " .. cfg.timeout .. " 秒），已放弃")
  end)

  hs.http.asyncPost(cfg.endpoint, hs.json.encode(body), headers, function(status, respBody, _)
    if done then
      return
    end
    done = true
    if timeoutTimer then
      timeoutTimer:stop()
    end

    if status ~= 200 then
      onError(classifyError(status, respBody))
      return
    end

    local ok, decoded = pcall(hs.json.decode, respBody)
    if not ok or not decoded then
      onError("返回内容解析失败")
      return
    end

    local answer
    if cfg.provider == "deepseek" then
      answer = decoded.choices and decoded.choices[1] and decoded.choices[1].message
        and decoded.choices[1].message.content or ""
    else
      answer = extractAnswer(decoded)
    end
    if answer == "" then
      onError("模型没有返回文本内容")
      return
    end

    onSuccess(answer)
  end)
end

return M
