local M = {}

local api = require("quickask.api")
local markdown = require("quickask.markdown")

local HTML_TEMPLATE = [[
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
    background: #1e1e1e;
    color: #eee;
  }
  body { display: flex; flex-direction: column; }
  #content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    font-size: 14px;
    line-height: 1.5;
  }
  #content .qa-question {
    font-weight: 600;
    margin: 10px 0 4px;
    color: #8ab4f8;
  }
  #content .qa-question:first-child { margin-top: 0; }
  #content .qa-thinking { color: #999; font-style: italic; }
  #content .qa-error { color: #f28b82; white-space: pre-wrap; }
  #content .qa-answer p { margin: 0 0 8px; }
  #content pre {
    background: #111;
    padding: 8px;
    border-radius: 6px;
    overflow-x: auto;
  }
  #content code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 13px; }
  #content pre code { display: block; }
  #content a { color: #8ab4f8; }
  #footer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border-top: 1px solid #333;
    flex-shrink: 0;
  }
  #attachments {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  #attachments:empty { display: none; }
  .qa-thumb {
    position: relative;
    width: 48px;
    height: 48px;
  }
  .qa-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #444;
  }
  .qa-thumb .qa-thumb-remove {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    line-height: 16px;
    text-align: center;
    border-radius: 50%;
    background: #555;
    color: #eee;
    font-size: 11px;
    cursor: pointer;
    border: 1px solid #222;
  }
  #inputRow {
    display: flex;
    gap: 8px;
  }
  #question {
    flex: 1;
    resize: none;
    height: 36px;
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 8px;
    font-size: 14px;
    font-family: inherit;
  }
  #question:disabled { opacity: 0.6; }
  button {
    background: #3a3a3a;
    color: #eee;
    border: 1px solid #555;
    border-radius: 6px;
    padding: 0 12px;
    cursor: pointer;
    font-size: 13px;
  }
  button:hover { background: #4a4a4a; }
</style>
</head>
<body>
  <div id="content"></div>
  <div id="footer">
    <div id="attachments"></div>
    <div id="inputRow">
      <textarea id="question" placeholder="输入问题，回车发送…（Esc 关闭，Cmd+V 贴图）"></textarea>
      <button onclick="qaSend()">发送</button>
      <button onclick="qaCopy()">复制回答</button>
    </div>
  </div>
<script>
  var lastAnswerText = "";
  var pendingImages = [];

  function post(msg) {
    window.webkit.messageHandlers.quickask.postMessage(msg);
  }

  function qaClose() { post({type: "close"}); }
  function qaCopy() { post({type: "copy"}); }

  function qaAttachImages(dataUrls) {
    dataUrls.forEach(function(u) { pendingImages.push(u); });
    qaRenderAttachments();
  }

  function qaRemoveImage(idx) {
    pendingImages.splice(idx, 1);
    qaRenderAttachments();
  }

  function qaRenderAttachments() {
    var box = document.getElementById("attachments");
    box.innerHTML = "";
    pendingImages.forEach(function(dataUrl, idx) {
      var thumb = document.createElement("div");
      thumb.className = "qa-thumb";

      var img = document.createElement("img");
      img.src = dataUrl;
      thumb.appendChild(img);

      var remove = document.createElement("div");
      remove.className = "qa-thumb-remove";
      remove.textContent = "×";
      remove.onclick = function() { qaRemoveImage(idx); };
      thumb.appendChild(remove);

      box.appendChild(thumb);
    });
  }

  function qaSend() {
    var el = document.getElementById("question");
    var text = el.value.trim();
    if (!text && pendingImages.length === 0) { return; }
    el.value = "";
    el.disabled = true;
    var images = pendingImages.slice();
    pendingImages = [];
    qaRenderAttachments();
    qaAddQuestion(text, images.length);
    post({type: "submit", question: text, images: images});
  }

  function qaAddQuestion(text, imageCount) {
    var content = document.getElementById("content");
    var q = document.createElement("div");
    q.className = "qa-question";
    var label = "Q: " + text;
    if (imageCount > 0) {
      label += (text ? " " : "") + "[附带 " + imageCount + " 张图片]";
    }
    q.textContent = label;
    content.appendChild(q);

    var thinking = document.createElement("div");
    thinking.className = "qa-thinking";
    thinking.textContent = "思考中…";
    thinking.id = "qa-pending";
    content.appendChild(thinking);

    content.scrollTop = content.scrollHeight;
  }

  function qaSetAnswer(html, rawText) {
    var pending = document.getElementById("qa-pending");
    if (pending) {
      var div = document.createElement("div");
      div.className = "qa-answer";
      div.innerHTML = html;
      pending.replaceWith(div);
    }
    lastAnswerText = rawText;
    var el = document.getElementById("question");
    el.disabled = false;
    el.focus();
    document.getElementById("content").scrollTop = document.getElementById("content").scrollHeight;
  }

  function qaSetError(msg) {
    var pending = document.getElementById("qa-pending");
    if (pending) {
      pending.className = "qa-error";
      pending.removeAttribute("id");
      pending.textContent = msg;
    }
    var el = document.getElementById("question");
    el.disabled = false;
    el.focus();
  }

  document.getElementById("question").addEventListener("paste", function() {
    // Image clipboard data isn't reliably exposed to page JS inside a WKWebView,
    // so ask Lua to check the real macOS pasteboard via hs.pasteboard instead.
    // Plain text paste is unaffected — the browser still handles that natively.
    post({type: "pasteCheck"});
  });

  document.getElementById("question").addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      qaSend();
    } else if (e.key === "Escape") {
      qaClose();
    }
  });

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      qaClose();
    } else if (e.metaKey && e.shiftKey && (e.key === "c" || e.key === "C")) {
      qaCopy();
    }
  });

  document.getElementById("question").focus();
</script>
</body>
</html>
]]

-- hs.json.encode only accepts a table, not a bare string, so build JS string
-- literals by hand for the evaluateJavaScript() calls below.
local function jsString(s)
  s = tostring(s or "")
  s = s:gsub("\\", "\\\\")
  s = s:gsub('"', '\\"')
  s = s:gsub("\n", "\\n")
  s = s:gsub("\r", "\\r")
  s = s:gsub("\t", "\\t")
  s = s:gsub("\226\128\168", "\\u2028") -- U+2028 LINE SEPARATOR
  s = s:gsub("\226\128\169", "\\u2029") -- U+2029 PARAGRAPH SEPARATOR
  return '"' .. s .. '"'
end

function M.newSession(cfg)
  local session = { history = {}, lastAnswer = "" }

  local uc = hs.webview.usercontent.new("quickask")
  uc:setCallback(function(message)
    local msgBody = message.body or {}

    if msgBody.type == "submit" then
      local question = msgBody.question or ""
      local images = msgBody.images
      if type(images) ~= "table" then
        images = {}
      end
      if question == "" and #images == 0 then
        return
      end

      api.ask(session.history, question, images, cfg, function(answer)
        local html = markdown.toHTML(answer)
        session.lastAnswer = answer
        if session.webview then
          session.webview:evaluateJavaScript(
            "qaSetAnswer(" .. jsString(html) .. "," .. jsString(answer) .. ")"
          )
        end

        table.insert(session.history, { question = question, answer = answer, images = images })
      end, function(errMsg)
        if session.webview then
          session.webview:evaluateJavaScript("qaSetError(" .. jsString(errMsg) .. ")")
        end
      end)
    elseif msgBody.type == "pasteCheck" then
      -- all=true: if multiple images were copied at once (e.g. several files
      -- selected in Finder), attach all of them in one paste, not just the first.
      local images = hs.pasteboard.readImage(nil, true)
      if images then
        local dataUrls = {}
        for _, img in ipairs(images) do
          local dataUrl = img:encodeAsURLString(false, "PNG")
          if dataUrl and not dataUrl:find("^data:") then
            dataUrl = "data:image/png;base64," .. dataUrl
          end
          if dataUrl then
            table.insert(dataUrls, dataUrl)
          end
        end
        if #dataUrls > 0 and session.webview then
          session.webview:evaluateJavaScript("qaAttachImages(" .. hs.json.encode(dataUrls) .. ")")
        end
      end
    elseif msgBody.type == "copy" then
      if session.lastAnswer and session.lastAnswer ~= "" then
        hs.pasteboard.setContents(session.lastAnswer)
      end
    elseif msgBody.type == "close" then
      session:destroy()
    end
  end)

  local screenFrame = hs.screen.mainScreen():frame()
  local w, h = 560, 420
  local rect = {
    x = screenFrame.x + (screenFrame.w - w) / 2,
    y = screenFrame.y + (screenFrame.h - h) / 3,
    w = w,
    h = h,
  }

  local webview = hs.webview.new(rect, { developerExtrasEnabled = false }, uc)
  webview:windowStyle({ "titled", "closable", "resizable" })
  webview:windowTitle("Quick Ask")
  webview:allowNewWindows(false)
  webview:allowTextEntry(true)
  webview:level(hs.drawing.windowLevels.floating)
  webview:html(HTML_TEMPLATE)
  webview:windowCallback(function(action)
    if action == "closing" then
      session.webview = nil
    end
  end)

  session.webview = webview
  session.uc = uc

  function session:show()
    if self.webview then
      self.webview:show()
      self.webview:bringToFront(true)
    end
  end

  function session:destroy()
    if self.webview then
      self.webview:delete()
      self.webview = nil
    end
  end

  return session
end

return M
