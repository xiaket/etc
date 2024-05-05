---------------------
-- Control family
---------------------
-- Ctrl F to format the file.
vim.keymap.set("n", "<C-F>", ":Format<cr>", { noremap = true, silent = true })
-- Ctrl E to clean up trailing whitespaces
vim.keymap.set("n", "<C-E>", ":%s/\\s*$//g<cr>", { noremap = true })
-- Ctrl V to paste in
vim.keymap.set("n", "<C-V>", '"*p', { noremap = true })
-- Use Ctrl-L to toggle the line number display.
vim.keymap.set("n", "<C-L>", ":lua Toggleln()<CR>", { noremap = true, silent = true })
-- get out of term
vim.keymap.set("t", "<Esc>", "<C-\\><C-n>", { noremap = true })

---------------------
-- leader family
---------------------
local leader_config = {
  ["a"] = { cmd = ":bprevious<cr>", desc = "previous buffer" },
  -- ["d"] used down below in LSP keymaps.
  ["e"] = { cmd = "<cmd>TroubleToggle<cr>", desc = "toggle errors" },
  ["f"] = { cmd = ":Telescope find_files<cr>", opts = { silent = false }, desc = "find files" },
  ["g"] = { cmd = ":Telescope live_grep<cr>", opts = { silent = false }, desc = "grep from files" },
  ["h"] = { cmd = ":FocusSplitLeft<cr>", desc = "create split on left" },
  ["j"] = { cmd = ":FocusSplitDown<cr>", desc = "create split below" },
  ["k"] = { cmd = ":FocusSplitUp<cr>", desc = "create split above" },
  ["l"] = { cmd = ":FocusSplitRight<cr>", desc = "create split on right" },
  ["n"] = { cmd = '<CMD>lua require("n").toggle()<CR>', desc = "toggle notes window" },
  ["o"] = {
    cmd = function()
      local files = require("mini.files")
      if not files.close() then
        files.open()
      end
    end,
    desc = "toggle files window",
  },
  ["s"] = { cmd = ":bnext<cr>", desc = "next buffer" },
  ["t"] = {
    { cmd = '<CMD>lua require("FTerm").toggle()<CR>', mode = "n", desc = "toggle terminal" },
    {
      cmd = '<C-\\><C-n><CMD>lua require("FTerm").toggle()<CR>',
      mode = "t",
      desc = "toggle terminal",
    },
  },
  ["z"] = { cmd = "za", desc = "toggle fold" },
}

-- LSP shortcuts has <leader> + d as prefix.
local lsp_keymap_config = {
  ["a"] = {
    desc = "See available code actions",
    cmd = vim.lsp.buf.code_action,
  },
  ["d"] = { desc = "Show LSP definitions", cmd = "<cmd>Telescope lsp_definitions<CR>" },
  ["D"] = {
    desc = "Show buffer diagnostics",
    cmd = "<cmd>Telescope diagnostics bufnr=0<CR>",
  },
  ["e"] = { desc = "Show line diagnostics", cmd = vim.diagnostic.open_float },
  ["g"] = { desc = "Go to declaration", cmd = vim.lsp.buf.declaration },
  ["i"] = {
    desc = "Show LSP implementations",
    cmd = "<cmd>Telescope lsp_implementations<CR>",
  },
  ["m"] = {
    desc = "Show documentation for what is under cursor",
    cmd = vim.lsp.buf.hover,
  },
  ["r"] = { desc = "Smart rename", cmd = vim.lsp.buf.rename },
  ["R"] = {
    desc = "Show LSP references",
    cmd = "<cmd>Telescope lsp_references<CR>",
  },
  ["t"] = {
    desc = "Show LSP type definitions",
    cmd = "<cmd>Telescope lsp_type_definitions<CR>",
  },
  ["["] = { desc = "Go to previous diagnostic", cmd = vim.diagnostic.goto_prev },
  ["]"] = { desc = "Go to next diagnostic", cmd = vim.diagnostic.goto_next },
}

local function set_keymap(key, cmd, opts, mode, desc)
  local options = { noremap = true, silent = true, desc = desc }
  for k, v in pairs(opts or {}) do
    options[k] = v
  end
  vim.keymap.set(mode or "n", "<leader>" .. key, cmd, options)
end

for key, configs in pairs(leader_config) do
  if type(configs[1]) == "table" then
    for _, config in ipairs(configs) do
      set_keymap(key, config.cmd, config.opts, config.mode, config.desc)
    end
  else
    set_keymap(key, configs.cmd, configs.opts, configs.mode, configs.desc)
  end
end

for key, config in pairs(lsp_keymap_config) do
  set_keymap("d" .. key, config.cmd, config.opts, "n", config.desc)
end
---------------------
-- misc
---------------------

-- Fix my typos, also Q maps to qa
vim.keymap.set("c", "Q!", "qa!", { noremap = true, expr = false, silent = false })
vim.keymap.set("c", "WQ", "wqa", { noremap = true, expr = false, silent = false })
vim.keymap.set("c", "wQ", "wqa", { noremap = true, expr = false, silent = false })
vim.keymap.set("c", "Wq", "wq", { noremap = true, expr = false, silent = false })

vim.api.nvim_create_autocmd("InsertLeave", {
  pattern = "*",
  callback = function()
    vim.o.paste = false
  end,
  once = true,
})

vim.api.nvim_create_autocmd({ "InsertLeave", "FocusLost" }, {
  pattern = "*",
  callback = function()
    local bufname = vim.api.nvim_buf_get_name(0)
    if bufname and #bufname > 0 then
      vim.api.nvim_command("wall")
    end
  end,
  once = false,
})

-- auto save and load views.
vim.api.nvim_create_autocmd("BufWrite", {
  pattern = "*",
  command = "mkview",
  once = true,
})

vim.api.nvim_create_autocmd("BufRead", {
  pattern = "*",
  command = "silent! loadview",
  once = true,
})

local aug = vim.api.nvim_create_augroup("FormatAutogroup", {})

vim.api.nvim_create_autocmd("BufWritePost", {
  pattern = "*.html,*.lua,*.py,*.tf",
  group = aug,
  command = ":Format",
})
