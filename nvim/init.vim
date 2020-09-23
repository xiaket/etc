"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Plugins that I've used
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" enable vim-plug
call plug#begin('~/.config/nvim/plugged')
Plug 'airblade/vim-gitgutter'
Plug 'psf/black', {'branch': 'stable'}
Plug 'bling/vim-airline'
Plug 'chriskempson/tomorrow-theme', {'rtp': 'vim/'}
Plug 'davidhalter/jedi-vim'
Plug 'ekalinin/Dockerfile.vim'
Plug 'ervandew/supertab'
Plug 'fatih/vim-go'
Plug 'hail2u/vim-css3-syntax'
Plug 'hynek/vim-python-pep8-indent'
Plug 'jiangmiao/auto-pairs'
Plug 'numirias/semshi', {'do': ':UpdateRemotePlugins'}
Plug 'rhysd/vim-gfm-syntax'
Plug 'roxma/nvim-yarp'
Plug 'SirVer/ultisnips'
Plug 'tpope/vim-haml'
Plug 'tpope/vim-surround'
Plug 'vim-airline/vim-airline-themes'
Plug 'vim-scripts/restore_view.vim'
Plug 'vim-ruby/vim-ruby'
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

function AppendHeader()
  " We would write header for these filetypes
  if !exists("g:Headers")
    let g:Headers = {}
  endif

  " get the suffix of the buffer, get the header from the defined dictionary,
  " join the content of the list with newline and insert the result string to
  " the start of the buffer.
  " If suffix is not found in dictionary, an empty list(empty string) is used.
  call setline(".", get(g:Headers, expand('%:e'), []))
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
" Do not change eol setting of the current file
set nofixendofline
" Do not redraw while running macros (much faster).
set lazyredraw
" Search related.
set showmatch
" Tab and indent
set expandtab
set tabstop=2
set softtabstop=2
set shiftwidth=2
set smartindent
autocmd FileType py set tabstop=4 softtabstop=4 shiftwidth=4
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
highlight Normal ctermbg=NONE
" case sensible when doing completion
set infercase

" relative line number
autocmd InsertEnter * :call RelativeLineNumber("number")
autocmd InsertLeave * :call RelativeLineNumber("relativenumber")
autocmd FocusLost * :call RelativeLineNumber("number")
autocmd CursorMoved * :call RelativeLineNumber("relativenumber")
autocmd InsertLeave * set nopaste

" file headers
" empty line in the list is converted to a newline
let g:Headers = {
  \"py": ["#!/usr/bin/env python3", "", ""],
  \"sh": ["#!/bin/bash", "", "set -o errexit", "set -o nounset", "set -o pipefail", "", ""],
\}
au BufNewFile * call AppendHeader()
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
let g:UltiSnipsSnippetDir="~/.vim/UltiSnips"
let g:UltiSnipsDoHash=0

"restore_view settings
set viewoptions=cursor,folds,slash,unix
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Key remaps
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" use space to open and close a fold
nnoremap <space> za
vnoremap <space> zf
nnoremap <silent> <C-L> :call ToggleLineNumber()<cr>:call gitgutter#toggle()<cr>
"Remove trailing spaces
nnoremap <silent> <C-E> :%s/\s*$//g<cr>
nnoremap <silent> <C-V> "*p
set pastetoggle=<C-P>
" In case of Q! and WQ, as I have to press Shift.
cmap Q! q!
cmap WQ wq
cmap Wq wq

" auto save on bufleave and lose focus.
autocmd BufLeave,FocusLost * silent! wall

" jedi-vim configurations
let g:mapleader = ","
let g:jedi#auto_vim_configuration = 0
let g:jedi#use_tabs_not_buffers = 1

" configuration for black
let g:black_linelength = 80
