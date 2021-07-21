-- bootstrap of packer, a package manager
local execute = vim.api.nvim_command
local install_path = vim.fn.stdpath('data')..'/site/pack/packer/opt/packer.nvim'

if vim.fn.empty(vim.fn.glob(install_path)) > 0 then
  execute('!git clone https://github.com/wbthomason/packer.nvim '..install_path)
end

vim.cmd [[packadd packer.nvim]]
vim.api.nvim_exec([[
  augroup Packer
    autocmd!
    autocmd BufWritePost packages.lua PackerCompile
  augroup end
]], false)

-- list of packages that I use.
local use = require('packer').use
require('packer').startup(function()
  use {'wbthomason/packer.nvim', opt = true}            -- package manager
  use 'nvim-lua/plenary.nvim'                           -- lua helpers

  -- nvim level setups.
  use 'neovim/nvim-lspconfig'                           -- language server setup
  use 'hrsh7th/nvim-compe'                              -- auto complete setup.

  -- global configurations.
  use 'bling/vim-airline'                               -- better status line
  use 'vim-airline/vim-airline-themes'                  -- collection of airline themes
  use {'chriskempson/tomorrow-theme', rtp = 'vim/'}     -- my preferred theme
  use 'SirVer/ultisnips'                                -- snippets
  use 'lewis6991/gitsigns.nvim'                         -- show git changes.
  use 'vim-scripts/restore_view.vim'                    -- save'n'restore view
  use 'windwp/nvim-autopairs'                           -- pairs helper

  -- python specific things.
  use 'psf/black'                                       -- python styling helper
  use {'numirias/semshi', run = ':UpdateRemotePlugins'} -- python syntax highlighter
  use 'Vimjas/vim-python-pep8-indent'                   -- better indentation

  -- other languages.
  use 'ekalinin/Dockerfile.vim'
  use 'fatih/vim-go'
  use 'rhysd/vim-gfm-syntax'
end)
