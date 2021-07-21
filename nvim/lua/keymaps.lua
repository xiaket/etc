-- Use space to toggle folds
vim.api.nvim_set_keymap('n', '<space>', 'za', {noremap = true})
vim.api.nvim_set_keymap('v', '<space>', 'zf', {noremap = true})

-- Ctrl E to clean up trailing whitespaces
vim.api.nvim_set_keymap('n', '<C-E>', ':%s/\\s*$//g<cr>', {noremap = true})
-- Ctrl V to paste in
vim.api.nvim_set_keymap('n', '<C-V>', '"*p', {noremap = true})
-- Ctrl S to toggle paste mode
vim.o.pastetoggle = "<C-S>"

-- Fix my typos
vim.api.nvim_set_keymap('c', 'Q!', 'q!', {noremap = true, expr = false, silent = false})
vim.api.nvim_set_keymap('c', 'WQ', 'wq', {noremap = true, expr = false, silent = false})
vim.api.nvim_set_keymap('c', 'Wq', 'wq', {noremap = true, expr = false, silent = false})
