local ui = require("quickask.ui")
local config = require("quickask.config")

local M = {}

function M.trigger()
  local cfg = config.get()
  local session = ui.newSession(cfg)
  session:show()
end

return M
