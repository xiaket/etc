local scopes = {o = vim.o, b = vim.bo, w = vim.wo, g = vim.g}
function option(key, value, scope)
  scope = scope or "o"
  scopes[scope][key] = value
  if scope ~= 'o' then
    scopes['o'][key] = value
  end
end

local tabsize = 2
local undo_dir = os.getenv("HOME") .. '/.vim/undo'
local bak_dir = os.getenv("HOME") .. '/.vim/backup'
os.execute("mkdir -p " .. undo_dir)
os.execute("mkdir -p " .. bak_dir)

-- encoding and formats.
vim.g.fileencodings = "utf-8,gbk,ucs-bom,cp936"
vim.g.fileformats = "unix,dos,mac"
-- Do not change eol setting of the current file
option("fixendofline", false)
-- Do not redraw while running macros (much faster).
option("lazyredraw", true)
-- Search related.
option("showmatch", true)
-- Tab and indent
option("expandtab", true)
option("smartindent", true)
option("tabstop", tabsize)
option("softtabstop", tabsize)
option("shiftwidth", tabsize)

-- autocmd FileType py set tabstop=4 softtabstop=4 shiftwidth=4
-- autocmd FileType make set noexpandtab shiftwidth=8

-- Enable folding
option("foldmethod", "indent")
option("foldlevel", 99)
-- Minimal number of screen lines to keep above and below the cursor.
option("scrolloff", 3)
-- always report number of lines affected.
option("report", 0)
-- backup and swap file
option("backup", true)
option("backupdir", bak_dir)
option("swapfile", false)

-- save undo history
option('undodir',  undo_dir)
vim.cmd('set undofile')
-- At times, I want to select text using the mouse and paste it somewhere, I
-- know '"*' works, but I just don't like that.
option("mouse", "iv")
-- case sensible when doing completion
option("infercase", true)

-- things saved in the view
option("viewoptions", "cursor,folds,slash,unix")
