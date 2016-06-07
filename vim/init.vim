"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Plugins that I've used
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" enable vim-plug
call plug#begin('~/.config/nvim/plugged')
Plug 'airblade/vim-gitgutter'
Plug 'bling/vim-airline'
Plug 'chriskempson/tomorrow-theme', {'rtp': 'vim/'}
Plug 'ervandew/supertab'
Plug 'fatih/vim-go'
Plug 'hdima/python-syntax'
Plug 'hynek/vim-python-pep8-indent'
Plug 'plasticboy/vim-markdown'
Plug 'scrooloose/nerdtree'
Plug 'SirVer/ultisnips'
Plug 'tpope/vim-haml'
Plug 'tpope/vim-rails'
Plug 'tpope/vim-surround'
Plug 'Valloric/YouCompleteMe', {'do': './install.py'}
Plug 'vim-airline/vim-airline-themes'
Plug 'vim-ruby/vim-ruby'
Plug 'vim-scripts/AutoClose'
Plug 'xiaket/better-header'
call plug#end()

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" vim functions
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
function RelativeLineNumber(target)
    if !exists("b:lnstatus")
        let b:lnstatus = "number"
    endif
    if b:lnstatus != "nonumber"
        if a:target == "number"
            set number
            set norelativenumber
        else
            set number
            set relativenumber
        endif
    else
        set nonumber
    endif
endfunction

function ToggleLineNumber()
    if !exists("b:lnstatus")
        let b:lnstatus = "number"
    endif
    if b:lnstatus == "number"
        set nonumber
        set norelativenumber
        let b:lnstatus = "nonumber"
    else
        set number
        set relativenumber
        let b:lnstatus = "number"
    endif
endfunction

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" vim hacks
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" encoding and formats.
set fileencodings=utf-8,gbk,ucs-bom,cp936
set fileformats=unix,dos,mac
" Do not redraw while running macros (much faster).
set lazyredraw
" Search related.
set showmatch
" Tab and indent
set expandtab
set tabstop=4
set softtabstop=4
set smartindent
autocmd FileType make set noexpandtab shiftwidth=8
" Enable folding
set foldmethod=indent
set foldlevel=99
" Minimal number of screen lines to keep above and below the cursor.
set scrolloff=3
" always report number of lines affected.
set report=0
" backup and swap file
set backup
set backupdir=~/.vim/backup
set nowb
set noswapfile
" save undo history
set undofile
set undodir=~/.vim/undo
" At times, I want to select text using the mouse and paste it somewhere, I
" know '"*' works, but I just don't like that.
set mouse=iv
" enable tomorrow colorscheme
colorscheme Tomorrow-Night-Eighties
" case sensible when doing completion
set infercase

" relative line number
autocmd InsertEnter * :call RelativeLineNumber("number")
autocmd InsertLeave * :call RelativeLineNumber("relativenumber")
autocmd FocusLost * :call RelativeLineNumber("number")
autocmd CursorMoved * :call RelativeLineNumber("relativenumber")

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Plugin tweaks.
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" airline
let g:airline_theme='tomorrow'

" YouCompleteMe
func! s:jInYCM()
    if pumvisible()
        return "\<C-n>"
    else
        return "\<c-j>"
endfunction

func! s:kInYCM()
    if pumvisible()
        return "\<C-p>"
    else
        return "\<c-k>"
endfunction

inoremap <c-j> <c-r>=g:jInYCM()<cr>
au BufEnter,BufRead * exec "inoremap <silent> " . g:UltiSnipsJumpBackwardTrigger . " <C-R>=g:kInYCM()<cr>"

" UltiSnip key mappings.
let g:UltiSnipsExpandTrigger="<c-j>"
let g:UltiSnipsJumpForwardTrigger="<c-j>"
let g:UltiSnipsJumpBackwardTrigger="<c-k>"

" UltiSnip settings.
let g:UltiSnipsSnippetDirectories=["/Users/xiaket/.vim/UltiSnips"]
let g:UltiSnipsDoHash=0

" NERD configurations
autocmd bufenter * if (winnr("$") == 1 && exists("b:NERDTree") && b:NERDTree.isTabTree()) | q | endif
let NERDTreeIgnore = ['\.pyc$']

" better header settings
let g:BHAUTHOR = 'Xia Kai <xiaket@gmail.com>'
let g:BHUnder = ['~/.xiaket/share/Dropbox/git', '~/.xiaket/share/repos']
let g:BHDebug = "0"
let g:BHEnabledSuffix = ['py', 'sh', 'rb']
let g:BHrbHeader = "# encoding: UTF-8\n# Author:         %(author)s\n# Filename:       %(filename)s\n# Date created:   %(cdate)s\n# Last modified:  %(date)s\n#\n# Description:\n#\n"

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Key remaps
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" use space to open and close a fold
nnoremap <space> za
vnoremap <space> zf
nnoremap <silent> <F2> :call ToggleLineNumber()<cr>:call gitgutter#toggle()<cr>
" use NERDTree
nnoremap <F4> :NERDTree<cr>
"Remove trailing spaces
map <silent> <F5> :%s/\s*$//g<cr>
" In case of Q! and WQ, as I have to press Shift.
cmap Q! q!
cmap WQ wq
cmap Wq wq

" Bash like keys for the command line
cnoremap <C-A> <Home>
cnoremap <C-E> <End>
cnoremap <C-P> <Up>
cnoremap <C-N> <Down>

" auto save on bufleave and lose focus.
autocmd BufLeave,FocusLost * silent! wall
