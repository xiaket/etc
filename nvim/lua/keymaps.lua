-- set leader to ,
vim.g.mapleader = ","

-- Use space to toggle folds
vim.api.nvim_set_keymap('n', '<space>', 'za', {noremap = true})
vim.api.nvim_set_keymap('v', '<space>', 'zf', {noremap = true})

-- Ctrl E to clean up trailing whitespaces
vim.api.nvim_set_keymap('n', '<C-E>', ':%s/\\s*$//g<cr>', {noremap = true})
-- Ctrl V to paste in
vim.api.nvim_set_keymap('n', '<C-V>', '"*p', {noremap = true})
-- Ctrl S to toggle paste mode
vim.o.pastetoggle = "<C-S>"

-- get out of term
vim.api.nvim_set_keymap('t', '<Esc>', '<C-\\><C-n>', {noremap = true})

-- moving around in windows
vim.api.nvim_set_keymap('n', '<A-h>', '<C-W>h', {noremap = true})
vim.api.nvim_set_keymap('n', '<A-l>', '<C-W>l', {noremap = true})
vim.api.nvim_set_keymap('n', '<A-j>', '<C-W>j', {noremap = true})
vim.api.nvim_set_keymap('n', '<A-k>', '<C-W>k', {noremap = true})
vim.api.nvim_set_keymap('n', '<leader>h', ':FocusSplitLeft<cr>', { silent = true })
vim.api.nvim_set_keymap('n', '<leader>j', ':FocusSplitDown<cr>', { silent = true })
vim.api.nvim_set_keymap('n', '<leader>k', ':FocusSplitUp<cr>', { silent = true })
vim.api.nvim_set_keymap('n', '<leader>l', ':FocusSplitRight<cr>', { silent = true })

-- Fix my typos, also Q maps to qa
vim.api.nvim_set_keymap('c', 'Q!', 'qa!', {noremap = true, expr = false, silent = false})
vim.api.nvim_set_keymap('c', 'WQ', 'wqa', {noremap = true, expr = false, silent = false})
vim.api.nvim_set_keymap('c', 'Wq', 'wq', {noremap = true, expr = false, silent = false})
