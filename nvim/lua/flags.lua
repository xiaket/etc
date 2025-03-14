-- vars
local opt = vim.o
local global = vim.g
local tabsize = 2

opt.shadafile = "NONE"
global.loaded_netrwPlugin = 1
global.loaded_matchparen = 1
global.loaded_matchit = 1
global.loaded_tarPlugin = 1
global.loaded_zipPlugin = 1
global.loaded_gzip = 1
global.loaded_remote_plugins = 1
global.loaded_man = 1
global.loaded_2html_plugin = 1
global.loaded_shada_plugin = 1
global.loaded_spellfile_plugin = 1

-- session management
opt.sessionoptions = "buffers,curdir,folds,tabpages,winpos,terminal"

-- generic options
global.fileencodings = "utf-8,gbk,ucs-bom,cp936" -- try these encodings in order
global.fileformats = "unix,dos,mac" -- try these formats in order
opt.fixendofline = false -- Do not change eol setting of the current file
opt.lazyredraw = true -- Do not redraw while running macros (much faster)
opt.showmatch = true -- Search related.
opt.scrolloff = 3 -- Number of lines to keep above/below the cursor
opt.report = 0 -- always report number of lines affected
opt.backup = true -- enable backup
opt.backupdir = os.getenv("HOME") .. "/.vim/backup" -- save backups to this directory
opt.swapfile = false -- no swap file, no
opt.viewoptions = "cursor,folds,slash,unix" -- things saved in the view
opt.infercase = true -- case sensible when doing completion
opt.mouse = "i" -- enable mouse only in insert mode
opt.spell = true -- enable spell checker

-- Tab and indent
opt.expandtab = true
opt.smartindent = true
opt.tabstop = tabsize
opt.softtabstop = tabsize
opt.shiftwidth = tabsize

-- Configure folding
opt.foldmethod = "indent"
opt.foldlevel = 99

-- UI enhancements
opt.pumblend = 10 -- Make builtin completion menus slightly transparent
opt.pumheight = 10 -- Make popup menu smaller
opt.winblend = 10 -- Make floating windows slightly transparent

-- save undo history
opt.undodir = os.getenv("HOME") .. "/.vim/undo"
opt.undofile = true

-- avante
opt.laststatus = 3
