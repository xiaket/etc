" tabs and indents.
setlocal textwidth=78
setlocal smartindent cinwords=if,elif,else,for,while,try,except,finally,def,class

" we want to hightlight every thing, but not indent.
" python-syntax.vim/syntax/python.vim
let python_highlight_indents=0
let python_highlight_all=1

" set the color of overlength lines and white space at EOL
highlight OverLength ctermbg=DarkRed ctermfg=white
match OverLength /\%80v.*/

" disable preview.
"setlocal completeopt=menu
" set table height.
"setlocal pumheight=8
