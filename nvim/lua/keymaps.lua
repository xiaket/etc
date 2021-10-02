-- Ctrl E to clean up trailing whitespaces
vim.api.nvim_set_keymap('n', '<C-E>', ':%s/\\s*$//g<cr>', {noremap = true})
-- Ctrl V to paste in
vim.api.nvim_set_keymap('n', '<C-V>', '"*p', {noremap = true})
-- Ctrl S to toggle paste mode
vim.o.pastetoggle = "<C-S>"
-- get out of term
vim.api.nvim_set_keymap('t', '<Esc>', '<C-\\><C-n>', {noremap = true})

-- Fix my typos, also Q maps to qa
vim.api.nvim_set_keymap('c', 'Q!', 'qa!', {noremap = true, expr = false, silent = false})
vim.api.nvim_set_keymap('c', 'WQ', 'wqa', {noremap = true, expr = false, silent = false})
vim.api.nvim_set_keymap('c', 'wQ', 'wqa', {noremap = true, expr = false, silent = false})
vim.api.nvim_set_keymap('c', 'Wq', 'wq', {noremap = true, expr = false, silent = false})
