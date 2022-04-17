---------------------
-- Control family
---------------------
-- Ctrl F to format the file.
vim.api.nvim_set_keymap("n", "<C-F>", ":Format<cr>", { noremap = true, silent = true })
-- Ctrl E to clean up trailing whitespaces
vim.api.nvim_set_keymap("n", "<C-E>", ":%s/\\s*$//g<cr>", { noremap = true })
-- Ctrl V to paste in
vim.api.nvim_set_keymap("n", "<C-V>", '"*p', { noremap = true })
-- get out of term
vim.api.nvim_set_keymap("t", "<Esc>", "<C-\\><C-n>", { noremap = true })
-- Ctrl S to toggle paste mode
vim.o.pastetoggle = "<C-S>"

---------------------
-- leader family
---------------------
vim.g.mapleader = ","

-- show undotree
vim.api.nvim_set_keymap("n", "<leader>u", ":UndotreeToggle<cr>", { noremap = true, silent = true })

-- split windows
vim.api.nvim_set_keymap("n", "<leader>h", ":FocusSplitLeft<cr>", { silent = true })
vim.api.nvim_set_keymap("n", "<leader>j", ":FocusSplitDown<cr>", { silent = true })
vim.api.nvim_set_keymap("n", "<leader>k", ":FocusSplitUp<cr>", { silent = true })
vim.api.nvim_set_keymap("n", "<leader>l", ":FocusSplitRight<cr>", { silent = true })

-- toggle terminal
vim.api.nvim_set_keymap("n", "<leader>t", '<CMD>lua require("FTerm").toggle()<CR>', { noremap = true, silent = true })
vim.api.nvim_set_keymap(
	"t",
	"<leader>t",
	'<C-\\><C-n><CMD>lua require("FTerm").toggle()<CR>',
	{ noremap = true, silent = true }
)

-- toggle lsp errors
vim.api.nvim_set_keymap("n", "<leader>e", "<cmd>TroubleToggle<cr>", { noremap = true, silent = true })

-- Telescope searches
vim.api.nvim_set_keymap("n", "<leader>f", ":Telescope find_files<cr>", { noremap = true, silent = false })
vim.api.nvim_set_keymap("n", "<leader>g", ":Telescope live_grep<cr>", { noremap = true, silent = false })

-- LSP searches
vim.api.nvim_set_keymap("n", "<leader>d", "<cmd>lua vim.lsp.buf.definition()<cr>", { noremap = true, silent = false })

---------------------
-- misc
---------------------

-- Fix my typos, also Q maps to qa
vim.api.nvim_set_keymap("c", "Q!", "qa!", { noremap = true, expr = false, silent = false })
vim.api.nvim_set_keymap("c", "WQ", "wqa", { noremap = true, expr = false, silent = false })
vim.api.nvim_set_keymap("c", "wQ", "wqa", { noremap = true, expr = false, silent = false })
vim.api.nvim_set_keymap("c", "Wq", "wq", { noremap = true, expr = false, silent = false })

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
