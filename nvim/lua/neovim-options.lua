-- aliases
local opt = vim.o
local run = vim.cmd

local tabsize = 2
local undo_dir = os.getenv("HOME") .. '/.vim/undo'
local bak_dir = os.getenv("HOME") .. '/.vim/backup'
os.execute("mkdir -p " .. undo_dir)
os.execute("mkdir -p " .. bak_dir)

-- generic options
vim.g.fileencodings = "utf-8,gbk,ucs-bom,cp936" -- try these encodings in order
vim.g.fileformats = "unix,dos,mac"              -- try these formats in order
vim.g.mapleader = ","                           -- set leader to ,
opt.fixendofline = false                        -- Do not change eol setting of the current file
opt.lazyredraw = true                           -- Do not redraw while running macros (much faster)
opt.showmatch = true                            -- Search related.
opt.scrolloff = 3                               -- Number of lines to keep above/below the cursor
opt.report = 0                                  -- always report number of lines affected
opt.backup = true                               -- enable backup
opt.backupdir = bak_dir                         -- save backups to this directory
opt.swapfile = false                            -- no swap file, no
opt.viewoptions = "cursor,folds,slash,unix"     -- things saved in the view
opt.infercase = true                            -- case sensible when doing completion
opt.mouse = "i"                                 -- enable mouse only in insert mode

-- Tab and indent
opt.expandtab = true
opt.smartindent = true
opt.tabstop = tabsize
opt.softtabstop = tabsize
opt.shiftwidth = tabsize
run('autocmd FileType py set tabstop=4 softtabstop=4 shiftwidth=4 textwidth=99')
run('autocmd FileType make set noexpandtab shiftwidth=8')
run('autocmd FileType go setlocal textwidth=99')

-- Configure folding
opt.foldmethod = "indent"
opt.foldlevel = 99
-- Use space to toggle folds
vim.api.nvim_set_keymap('n', '<space>', 'za', {noremap = true})

-- save undo history
opt.undodir = undo_dir
run('set undofile')

-- Leave paste mode once we leave insert mode.
run('autocmd InsertLeave * set nopaste')
-- auto save on bufleave and lose focus.
run('autocmd BufLeave,FocusLost * silent! wall')
