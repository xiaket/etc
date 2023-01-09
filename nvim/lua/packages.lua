return {
  "nvim-lua/plenary.nvim",
  "kyazdani42/nvim-web-devicons",
  "EdenEast/nightfox.nvim",

  -- Load by filetype
  {
    "ekalinin/Dockerfile.vim",
    ft = { "Dockerfile" },
  },
  { -- go support.
    "fatih/vim-go",
    ft = "go",
  },
  { -- pest support.
    "pest-parser/pest.vim",
    ft = "pest",
  },
  {
    "hashivim/vim-terraform",
    ft = "terraform",
  },
  {
    "rhysd/vim-gfm-syntax",
    ft = "markdown",
  },
  {
    "Vimjas/vim-python-pep8-indent",
    ft = "python",
  },

  -- Load by cmd
  { -- easier split management.
    "beauwilliams/focus.nvim",
    cmd = { "FocusSplitLeft", "FocusSplitDown", "FocusSplitUp", "FocusSplitRight" },
    config = function()
      require("focus").setup({ hybridnumber = true })
    end,
  },

  {
    "dstein64/vim-startuptime",
    cmd = "StartupTime",
    config = function()
      vim.g.startuptime_tries = 10
    end,
  },

  {
    "mhartington/formatter.nvim",
    cmd = { "Format" },
    config = function()
      require("formatter").setup({
        filetype = {
          lua = {
            function()
              return {
                exe = "stylua",
                args = {
                  "--config-path " .. os.getenv("XDG_CONFIG_HOME") .. "/stylua/stylua.toml",
                  "-",
                },
                stdin = true,
              }
            end,
          },
          python = {
            function()
              return {
                exe = "black",
                args = { "- --line-length 100" },
                stdin = true,
              }
            end,
          },
          rust = {
            function()
              return {
                exe = "rustfmt",
                stdin = true,
              }
            end,
          },
          sh = {
            function()
              return {
                exe = "shfmt",
                args = { "-i 2" },
                stdin = true,
              }
            end,
          },
          yaml = {
            function()
              return {
                exe = "yamlfix",
                stdin = true,
              }
            end,
          },
        },
      })
    end,
  },

  -- Load when BufRead
  {
    "echasnovski/mini.nvim",
    event = "BufRead",
    config = function()
      local animate = require('mini.animate')
      local options = {
        enable = {timing = animate.gen_timing.linear({ duration = 50, unit = 'total' })},
        disable = {enable = false},
      }
      animate.setup({
        open = options.disable,
        close = options.disable,
        resize = options.enable,
        cursor = options.enable,
        scroll = options.enable,
      })
      require('mini.pairs').setup()
      require('mini.statusline').setup()
      require('mini.tabline').setup()
    end,
  },
  {
    "monkoose/matchparen.nvim",
    event = "BufRead",
    config = function()
      require('matchparen').setup()
    end,
  },
  { -- show lsp errors in a buffer.
    "folke/trouble.nvim",
    event = "BufRead",
  },
  { -- show git change statuses.
    "lewis6991/gitsigns.nvim",
    event = "BufRead",
    config = function()
      require('gitsigns').setup()
    end,
  },
  { -- spell check setup
    "lewis6991/spellsitter.nvim",
    event = "BufRead",
    config = function()
      require("spellsitter").setup({
        hl = "SpellBad",
        captures = { "comment", "string" },
      })
    end,
  },
  { -- stabilize buffer on windows size changes.
    "luukvbaal/stabilize.nvim",
    event = "BufRead",
  },
  { -- visualize undos
    "mbbill/undotree",
    event = "BufRead",
  },
  { -- replace vimscript version of matchparen
    "monkoose/matchparen.nvim",
    event = "BufRead",
  },
  { -- better :term.
    "numtostr/FTerm.nvim",
    event = "BufRead",
  },
  {
    "nvim-telescope/telescope.nvim",
    event = "BufRead",
    config = function()
      require('opts.telescope')
    end,
  },

  { -- telescope
    "nvim-telescope/telescope-fzf-native.nvim",
    event = "BufRead",
    build = "make",
  },

  -- Other plugins
  { -- treesitter
    "nvim-treesitter/nvim-treesitter",
    config = function()
      require("nvim-treesitter").setup({
        ensure_installed = { "python", "bash", "go", "json", "lua", "rust", "yaml" },
        highlight = { enable = true, additional_vim_regex_highlighting = false },
        indent = { enable = true, disable = { "python" } },
      })
    end,
  },

  -- cmp & friends
  {
    "onsails/lspkind.nvim",
  },
  {
    "hrsh7th/nvim-cmp",
    event = "InsertEnter",
    dependencies = {
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-path",
      "hrsh7th/cmp-nvim-lua",
      "saadparwaiz1/cmp_luasnip",
      {
        "tzachar/cmp-tabnine",
        build = "./install.sh",
      },
      {
        "L3MON4D3/LuaSnip",
        config = function()
          require("opts.snippets")
        end,
      },
    },
    config = function()
      require('opts.cmp')
    end,
  },
  {
    "neovim/nvim-lspconfig",
    config = function()
      require("lspconfig").gopls.setup({})
      require("lspconfig").ltex.setup({
        settings = {
          ltex = {
            additionalRules = { languageModel = "~/Documents/ngram/" },
          },
        },
      })
      require("lspconfig").rust_analyzer.setup({})
    end,
  },
  {
    "ray-x/lsp_signature.nvim",
    config = function()
      require("lsp_signature").setup()
    end,
  },
}
