return {
  "nvim-lua/plenary.nvim",
  "kyazdani42/nvim-web-devicons",
  "EdenEast/nightfox.nvim",

  -- wip
  {
    dir = "~/.Github/n.nvim",
    opts = {
      dbpath = "~/.Github/etc/nvim/notes.db",
    },
    dependencies = {
      "kkharji/sqlite.lua",
      "nvim-lua/plenary.nvim",
    },
  },

  -- Load by filetype
  {
    "ekalinin/Dockerfile.vim",
    ft = { "Dockerfile" },
  },
  { -- go support.
    "fatih/vim-go",
    ft = "go",
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
    "nvim-focus/focus.nvim",
    cmd = { "FocusSplitLeft", "FocusSplitDown", "FocusSplitUp", "FocusSplitRight" },
    opts = {
      autoresize = { enable = true },
      ui = { number = false, hybridnumber = false, relativenumber = false },
    },
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
            function()
              local util = require("formatter.util")
              return {
                exe = "ruff",
                args = {
                  "check",
                  "--select",
                  "I001",
                  "--fix",
                  "--stdin-filename",
                  util.escape_path(util.get_current_buffer_file_path()),
                },
                stdin = true,
              }
            end,
          },
          rust = {
            require("formatter.filetypes.rust").rustfmt,
          },
          sh = {
            require("formatter.filetypes.sh").shfmt,
          },
          terraform = {
            require("formatter.filetypes.terraform").terraformfmt,
          },
          yaml = {
            require("formatter.filetypes.yaml").pyaml,
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
      local animate = require("mini.animate")
      local options = {
        enable = { timing = animate.gen_timing.linear({ duration = 50, unit = "total" }) },
        disable = { enable = false },
      }
      animate.setup({
        open = options.disable,
        close = options.disable,
        resize = options.enable,
        cursor = options.enable,
        scroll = options.enable,
      })
      require("mini.comment").setup()
      require("mini.cursorword").setup()
      require("mini.files").setup({
        mappings = {
          go_in = "L",
          go_in_plus = "l",
        },
      })
      require("mini.indentscope").setup({
        draw = {
          delay = 40,
          animation = require("mini.indentscope").gen_animation.none(),
        },
      })
      require("mini.pairs").setup()
      require("mini.tabline").setup({ show_icons = false })
    end,
  },
  {
    "monkoose/matchparen.nvim",
    event = "BufRead",
    opts = {},
  },
  { -- show lsp errors in a buffer.
    "folke/trouble.nvim",
    event = "BufRead",
  },
  { -- show git change statuses.
    "lewis6991/gitsigns.nvim",
    event = "BufRead",
    opts = {},
  },
  { -- stabilize buffer on windows size changes.
    "luukvbaal/stabilize.nvim",
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
      require("opts.telescope")
    end,
  },

  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    init = function()
      vim.o.timeout = true
      vim.o.timeoutlen = 300
    end,
    opts = {},
  },

  { -- telescope
    "nvim-telescope/telescope-fzf-native.nvim",
    event = "BufRead",
    build = "make",
  },

  -- treesitter
  {
    "nvim-treesitter/nvim-treesitter",
    config = function()
      require("nvim-treesitter").setup({
        ensure_installed = { "python", "bash", "go", "json", "lua", "rust", "yaml" },
        highlight = { enable = true, additional_vim_regex_highlighting = false },
        indent = { enable = true, disable = { "python" } },
      })
    end,
  },

  -- LSP
  {
    "williamboman/mason.nvim",
    dependencies = {
      "williamboman/mason-lspconfig.nvim",
    },
    event = "VeryLazy",
    opts = {},
  },
  {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = {
      "hrsh7th/cmp-nvim-lsp",
    },
    config = function()
      local lspconfig = require("lspconfig")
      local mason = require("mason-lspconfig")
      local cmp = require("cmp_nvim_lsp")

      mason.setup({
        ensure_installed = {
          "bashls",
          "bzl",
          "docker_compose_language_service",
          "dockerls",
          "gopls",
          "lua_ls",
          "pyright",
          "taplo", -- toml
          "terraformls",
        },
        automatic_installation = true,
      })

      mason.setup_handlers({
        -- default handler for installed servers
        function(server_name)
          lspconfig[server_name].setup({
            capabilities = capabilities,
          })
        end,
        ["bzl"] = function()
          lspconfig["bzl"].setup({
            filetypes = { "bzl", "BUILD", "bazel" },
          })
        end,
        ["pyright"] = function()
          local get_python_venv = function()
            if vim.env.VIRTUAL_ENV then
              return vim.env.VIRTUAL_ENV
            end

            local cwd = vim.fn.getcwd()
            while true do
              if cwd == "/" then
                break
              end

              local match = vim.fn.glob(cwd, "Venv")
              if match ~= "" then
                return cwd .. "/Venv"
              end
              local rev = string.reverse(cwd)
              local index = string.find(rev, "/")
              if index == nil then
                break
              end
              cwd = string.reverse(string.sub(rev, index + 1))
            end
          end

          local venv = get_python_venv()

          lspconfig["pyright"].setup({
            capabilities = cmp.default_capabilities(vim.lsp.protocol.make_client_capabilities()),
            settings = {
              pyright = {
                autoImportCompletion = true,
              },
              python = {
                pythonPath = venv .. "/bin/python3",
                analysis = {
                  autoSearchPaths = true,
                  diagnosticMode = "openFilesOnly",
                  useLibraryCodeForTypes = true,
                  typeCheckingMode = "off",
                },
              },
            },
          })
        end,
        ["lua_ls"] = function()
          -- configure lua server (with special settings)
          lspconfig["lua_ls"].setup({
            capabilities = capabilities,
            settings = {
              Lua = {
                -- make the language server recognize "vim" global
                diagnostics = {
                  globals = { "vim" },
                },
                completion = {
                  callSnippet = "Replace",
                },
              },
            },
          })
        end,
      })
    end,
  },

  -- cmp
  {
    "hrsh7th/nvim-cmp",
    event = "InsertEnter",
    dependencies = {
      "onsails/lspkind.nvim",
      "ray-x/lsp_signature.nvim",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-path",
      "hrsh7th/cmp-nvim-lua",
      "saadparwaiz1/cmp_luasnip",
      {
        "Exafunction/codeium.nvim",
        opts = {},
      },
      {
        "L3MON4D3/LuaSnip",
        config = function()
          require("opts.snippets")
        end,
      },
    },
    config = function()
      require("opts.cmp")
    end,
  },
}
