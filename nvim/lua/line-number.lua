local function relativeln(target)
  if vim.b.lnstatus == nil then
    vim.b.lnstatus = "number"
  end

  if vim.b.lnstatus ~= "nonumber" then
    if target == "number" then
      vim.o.number = true
      vim.o.relativenumber = false
    else
      vim.o.number = true
      vim.o.relativenumber = true
    end
  else
    vim.o.number = false
  end
end

-- Show relative line number when in command mode and absolute line number in edit mode
local _group = vim.api.nvim_create_augroup("LineNumber", { clear = true })
local autocmd_config = {
  ["InsertEnter"] = "number",
  ["InsertLeave"] = "relativenumber",
  ["FocusLost"] = "number",
  ["CursorMoved"] = "relativenumber",
}

for event, argument in pairs(autocmd_config) do
  vim.api.nvim_create_autocmd(event, {
    pattern = "*",
    callback = function()
      relativeln(argument)
    end,
    once = true,
    group = _group,
  })
end

function Toggleln()
  if vim.b.lnstatus == nil then
    vim.b.lnstatus = "number"
  end

  if vim.b.lnstatus == "number" then
    vim.o.number = false
    vim.o.relativenumber = false
    vim.b.lnstatus = "nonumber"
  else
    vim.o.number = true
    vim.o.relativenumber = true
    vim.b.lnstatus = "number"
  end
  require("gitsigns").toggle_signs()
end
