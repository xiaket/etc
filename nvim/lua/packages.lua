-- bootstrap of packer, a package manager
local execute = vim.api.nvim_command
local install_path = vim.fn.stdpath('data')..'/site/pack/packer/opt/packer.nvim'

if vim.fn.empty(vim.fn.glob(install_path)) > 0 then
  execute('!git clone https://github.com/wbthomason/packer.nvim '..install_path)
end

vim.cmd [[packadd packer.nvim]]
local packer_group = vim.api.nvim_create_augroup("Packer", { clear = true })
vim.api.nvim_create_autocmd("BufWritePost", {pattern = "packages.lua", command = "PackerCompile", once = true, group = packer_group})

-- list of packages that I use.
local use = require('packer').use
require('packer').startup(function()
  use {'wbthomason/packer.nvim', opt = true}            -- package manager
  use 'nvim-lua/plenary.nvim'                           -- lua helpers

  -- nvim level setups.
  use {
    'nvim-treesitter/nvim-treesitter', run = ':TSUpdate'
  }                                                     -- treesitter
  use 'neovim/nvim-lspconfig'                           -- language server setup
  use "ray-x/lsp_signature.nvim"                        -- helper with function signatures
  use 'nvim-telescope/telescope.nvim'                   -- telescope
  use {
    'nvim-telescope/telescope-fzf-native.nvim', run = 'make'
  }
  use {
    "nvim-telescope/telescope-frecency.nvim",
    config = function()
      require"telescope".load_extension("frecency")
    end,
    requires = {"tami5/sqlite.lua"}
  }                                                     -- telescope extension

  -- global configurations.
  use 'hrsh7th/cmp-nvim-lsp'
  use 'hrsh7th/cmp-buffer'
  use 'hrsh7th/cmp-path'
  use 'saadparwaiz1/cmp_luasnip'
  use 'hrsh7th/nvim-cmp'                                -- auto complete setup
  use 'L3MON4D3/LuaSnip'                                -- snippets
  use 'EdenEast/nightfox.nvim'                          -- theme
  use 'hoob3rt/lualine.nvim'                            -- statusline.
  use 'lewis6991/gitsigns.nvim'                         -- show git changes.
  use 'vim-scripts/restore_view.vim'                    -- save'n'restore view
  use 'lukas-reineke/format.nvim'                       -- format files

  use 'lewis6991/spellsitter.nvim'                      -- spell check setup
  use "caenrique/swap-buffers.nvim"                     -- swap vim windows on demand
  use 'beauwilliams/focus.nvim'                         -- window management
  use 'rmagatti/auto-session'                           -- session management
  use "luukvbaal/stabilize.nvim"                        -- stabiliser
  use "numtostr/FTerm.nvim"                             -- better :term.
  use "windwp/nvim-autopairs"                           -- pairing 
  use "mbbill/undotree"                                 -- visualize undos
  use "folke/trouble.nvim"

  -- python specific things.
  use {'numirias/semshi', run = ':UpdateRemotePlugins'} -- python syntax highlighter
  use 'Vimjas/vim-python-pep8-indent'                   -- better indentation

  -- other languages.
  use 'ekalinin/Dockerfile.vim'                         -- Dockerfile
  use 'fatih/vim-go'                                    -- golang
  use 'rhysd/vim-gfm-syntax'                            -- markdown
end)
