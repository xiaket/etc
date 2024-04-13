---------------------
-- Control family
---------------------
-- Ctrl F to format the file.
vim.keymap.set("n", "<C-F>", ":Format<cr>", { noremap = true, silent = true })
-- Ctrl E to clean up trailing whitespaces
vim.keymap.set("n", "<C-E>", ":%s/\\s*$//g<cr>", { noremap = true })
-- Ctrl V to paste in
vim.keymap.set("n", "<C-V>", '"*p', { noremap = true })
-- get out of term
vim.keymap.set("t", "<Esc>", "<C-\\><C-n>", { noremap = true })

---------------------
-- leader family
---------------------
-- buffer navigation
vim.keymap.set("n", "<leader>a", ":bprevious<cr>", { noremap = true, silent = true })
vim.keymap.set("n", "<leader>s", ":bnext<cr>", { noremap = true, silent = true })
-- show undotree
vim.keymap.set("n", "<leader>u", ":UndotreeToggle<cr>", { noremap = true, silent = true })

-- split windows
vim.keymap.set("n", "<leader>h", ":FocusSplitLeft<cr>", { silent = true })
vim.keymap.set("n", "<leader>j", ":FocusSplitDown<cr>", { silent = true })
vim.keymap.set("n", "<leader>k", ":FocusSplitUp<cr>", { silent = true })
vim.keymap.set("n", "<leader>l", ":FocusSplitRight<cr>", { silent = true })

-- toggle terminal
vim.keymap.set(
  "n",
  "<leader>t",
  '<CMD>lua require("FTerm").toggle()<CR>',
  { noremap = true, silent = true }
)
vim.keymap.set(
  "t",
  "<leader>t",
  '<C-\\><C-n><CMD>lua require("FTerm").toggle()<CR>',
  { noremap = true, silent = true }
)

-- toggle lsp errors
vim.keymap.set("n", "<leader>e", "<cmd>TroubleToggle<cr>", { noremap = true, silent = true })

-- Telescope searches
vim.keymap.set("n", "<leader>f", ":Telescope find_files<cr>", { noremap = true, silent = false })
vim.keymap.set("n", "<leader>g", ":Telescope live_grep<cr>", { noremap = true, silent = false })

-- LSP searches
vim.keymap.set(
  "n",
  "<leader>d",
  "<cmd>lua vim.lsp.buf.definition()<cr>",
  { noremap = true, silent = false }
)

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
    vim.api.nvim_command("wall")
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
