-- plugin setups
--- enable tomorrow colorscheme in airline
vim.g.airline_theme = 'tomorrow'

--- force loading the package so the directory is in runtime path.
--- and the color scheme file can be found.
vim.cmd("packadd tomorrow-theme/vim")
vim.cmd("colorscheme Tomorrow-Night-Eighties")
vim.cmd("highlight Normal ctermbg=NONE")

-- gitsigns setup
require('gitsigns').setup()

-- auto pairs setup.
require('nvim-autopairs').setup()

-- luasnip setup
local luasnip = require("luasnip")

-- compe setup
vim.o.completeopt = "menuone,noselect"
require'compe'.setup {
  min_length = 3;

  source = {
    path = true;
    buffer = true;
    nvim_lsp = true;
    spell = true;
    luasnip = true;
  };
}

local t = function(str)
  return vim.api.nvim_replace_termcodes(str, true, true, true)
end

local check_back_space = function()
    local col = vim.fn.col('.') - 1
    return col == 0 or vim.fn.getline('.'):sub(col, col):match('%s')
end

-- Use (s-)tab to:
--- move to prev/next item in completion menuone
--- jump to prev/next snippet's placeholder
_G.tab_complete = function()
  if vim.fn.pumvisible() == 1 then
    return t "<C-n>"
  elseif luasnip.expand_or_jumpable() then
    return t "<cmd>lua require'luasnip'.jump(1)<Cr>"
  elseif check_back_space() then
    return t "<Tab>"
  else
    return vim.fn['compe#complete']()
  end
end

_G.s_tab_complete = function()
  if vim.fn.pumvisible() == 1 then
    return t "<C-p>"
  elseif luasnip.jumpable(-1) then
    return t "<cmd>lua require'luasnip'.jump(-1)<Cr>"
  else
    -- If <S-Tab> is not working in your terminal, change it to <C-h>
    return t "<S-Tab>"
  end
end

-- compe keymaps setup
vim.api.nvim_set_keymap("i", "<Tab>", "v:lua.tab_complete()", {expr = true})
vim.api.nvim_set_keymap("s", "<Tab>", "v:lua.tab_complete()", {expr = true})
vim.api.nvim_set_keymap("i", "<S-Tab>", "v:lua.s_tab_complete()", {expr = true})
vim.api.nvim_set_keymap("s", "<S-Tab>", "v:lua.s_tab_complete()", {expr = true})

-- autopairs & compe keymaps setup
vim.api.nvim_set_keymap('i', '<C-Space>', 'compe#complete()', {noremap = true, expr = true, silent = true})
vim.api.nvim_set_keymap('i', '<CR>', [[compe#confirm(luaeval("require 'nvim-autopairs'.autopairs_cr()"))]], {noremap = true, expr = true, silent = true})
vim.api.nvim_set_keymap('i', '<C-e>', 'compe#close("<C-e>")', {noremap = true, expr = true, silent = true})

-- Do language server protocol setup
require'lspconfig'.pylsp.setup{
  on_attach = on_attach_vim,
  settings = {
    pylsp = {
      plugins = {
        pycodestyle =  { enabled = false },
        pylint =  { enabled = false },
        mccabe =  { enabled = false },
      }
    }
  }
}
