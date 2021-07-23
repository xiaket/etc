local tabsize = 2
local undo_dir = os.getenv("HOME") .. '/.vim/undo'
local bak_dir = os.getenv("HOME") .. '/.vim/backup'
os.execute("mkdir -p " .. undo_dir)
os.execute("mkdir -p " .. bak_dir)

-- encoding and formats.
vim.g.fileencodings = "utf-8,gbk,ucs-bom,cp936"
vim.g.fileformats = "unix,dos,mac"
-- Do not change eol setting of the current file
vim.o.fixendofline = false
-- Do not redraw while running macros (much faster).
vim.o.lazyredraw = true
-- Search related.
vim.o.showmatch = true
-- Tab and indent
vim.o.expandtab = true
vim.o.smartindent = true
vim.o.tabstop = tabsize
vim.o.softtabstop = tabsize
vim.o.shiftwidth = tabsize

vim.cmd('autocmd FileType py set tabstop=4 softtabstop=4 shiftwidth=4')
vim.cmd('autocmd FileType make set noexpandtab shiftwidth=8')

-- Enable folding
vim.o.foldmethod = "indent"
vim.o.foldlevel = 99
-- Minimal number of screen lines to keep above and below the cursor.
vim.o.scrolloff = 3
-- always report number of lines affected.
vim.o.report = 0
-- backup and swap file
vim.o.backup = true
vim.o.backupdir = bak_dir
vim.o.swapfile = false

-- save undo history
vim.o.undodir = undo_dir
vim.cmd('set undofile')

-- At times, I want to select text using the mouse and paste it somewhere, I
-- know '"*' works, but I just don't like that.
vim.o.mouse = "iv"
-- case sensible when doing completion
vim.o.infercase = true

-- things saved in the view
vim.o.viewoptions = "cursor,folds,slash,unix"

-- Leave paste mode once we leave insert mode.
vim.cmd('autocmd InsertLeave * set nopaste')
-- auto save on bufleave and lose focus.
vim.cmd('autocmd BufLeave,FocusLost * silent! wall')
