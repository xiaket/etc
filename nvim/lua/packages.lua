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
  use {'nvim-treesitter/nvim-treesitter', run = ':TSUpdate'}      -- treesitter
  use 'neovim/nvim-lspconfig'                           -- language server setup
  use 'nvim-telescope/telescope.nvim'                   -- telescope
  use {'nvim-telescope/telescope-fzf-native.nvim', run = 'make' } -- telescope extension

  -- global configurations.
  use 'windwp/nvim-autopairs'                           -- pairs helper
  use 'hrsh7th/cmp-nvim-lsp'
  use 'hrsh7th/cmp-buffer'
  use 'saadparwaiz1/cmp_luasnip'
  use 'hrsh7th/nvim-cmp'                                -- auto complete setup
  use 'L3MON4D3/LuaSnip'                                -- snippets
  use 'EdenEast/nightfox.nvim'                          -- theme
  use 'hoob3rt/lualine.nvim'                            -- statusline.
  use 'lewis6991/gitsigns.nvim'                         -- show git changes.
  use 'vim-scripts/restore_view.vim'                    -- save'n'restore view
  use 'mhartington/formatter.nvim'                      -- (auto) format files
  use 'lewis6991/spellsitter.nvim'                      -- spell check setup
  use 'beauwilliams/focus.nvim'                         -- window management
  use 'rmagatti/auto-session'                           -- session management

  -- python specific things.
  use {'numirias/semshi', run = ':UpdateRemotePlugins'} -- python syntax highlighter
  use 'Vimjas/vim-python-pep8-indent'                   -- better indentation

  -- other languages.
  use 'ekalinin/Dockerfile.vim'                         -- Dockerfile
  use 'fatih/vim-go'                                    -- golang
  use 'rhysd/vim-gfm-syntax'                            -- markdown
end)
