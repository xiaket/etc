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

  -- Load when BufWritePre
  {
    "stevearc/conform.nvim",

    event = { "BufWritePre" },
    cmd = { "ConformInfo" },
    opts = {
      -- Define your formatters
      formatters_by_ft = {
        lua = { "stylua" },
        python = { "black", "ruff_fix" },
        sh = { "shfmt" },
        rust = { "rustfmt" },
        terraform = { "terraform_fmt" },
        yaml = { "yamlfix" },
      },
      -- Set default options
      default_format_opts = {
        lsp_format = "fallback",
      },
      -- Set up format-on-save
      format_on_save = { timeout_ms = 500 },
      -- Customize formatters
      formatters = {
        shfmt = {
          prepend_args = { "-i", "2" },
        },
        black = {
          prepend_args = { "--line-length", "100" },
        },
        ruff_fix = {
          append_args = { "--select", "I001" },
        },
        stylua = {
          prepend_args = {
            "--config-path",
            os.getenv("XDG_CONFIG_HOME") .. "/stylua/stylua.toml",
          },
        },
      },
    },
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
      "saghen/blink.cmp",
    },
    event = "VeryLazy",
    opts = {},
  },
  {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile" },
    config = function(_, opts)
      local lspconfig = require("lspconfig")
      local mason = require("mason-lspconfig")

      for server, config in pairs(opts.servers or {}) do
        config.capabilities = require("blink.cmp").get_lsp_capabilities(config.capabilities)
        lspconfig[server].setup(config)
      end

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

  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    init = function()
      vim.o.timeout = true
      vim.o.timeoutlen = 300
    end,
    opts = {},
  },

  {
    "yetone/avante.nvim",
    event = "VeryLazy",
    lazy = false,
    version = false, -- set this if you want to always pull the latest change
    opts = {
      provider = "openai",
      auto_suggestions_provider = "openai",
    },
    -- if you want to build from source then do `make BUILD_FROM_SOURCE=true`
    build = "make",
    -- build = "powershell -ExecutionPolicy Bypass -File Build.ps1 -BuildFromSource false" -- for windows
    dependencies = {
      "nvim-treesitter/nvim-treesitter",
      "stevearc/dressing.nvim",
      "nvim-lua/plenary.nvim",
      "MunifTanjim/nui.nvim",
      --- The below dependencies are optional,
      "nvim-tree/nvim-web-devicons", -- or echasnovski/mini.icons
      {
        -- Make sure to set this up properly if you have lazy=true
        "MeanderingProgrammer/render-markdown.nvim",
        opts = {
          file_types = { "markdown", "Avante" },
        },
        ft = { "markdown", "Avante" },
      },
    },
  },

  {
    -- dir = "/Users/kaix/.Github/blink.cmp",
    -- dev = true,
    "saghen/blink.cmp",
    dependencies = {
      {
        "saghen/blink.compat",
        opts = { enable_events = true, debug = true },
        commit = "006a34130ed17248affefbef702f7226aeb29e0b",
      },
      {
        "Exafunction/codeium.nvim",
        dependencies = {
          "nvim-lua/plenary.nvim",
        },
        opts = {},
      },
    },
    lazy = false,
    version = "v0.*", -- use a release tag to download pre-built binaries

    opts = {
      -- Press tab to select and enter to accept, shift tab to reverse.
      keymap = {
        preset = "enter",
        ["<Tab>"] = {
          function(cmp)
            if cmp.is_in_snippet() then
              return cmp.accept()
            else
              return cmp.select_next()
            end
          end,
          "snippet_forward",
          "fallback",
        },
        ["<S-Tab>"] = {
          "snippet_backward",
          "select_prev",
          "fallback",
        },
      },
      accept = {
        auto_brackets = { enabled = true },
        -- expand_snippet = luasnip.lsp_expand,
      },
      trigger = { signature_help = { enabled = true } },

      sources = {
        completion = {
          enabled_providers = { "lsp", "path", "snippets", "buffer", "codeium" },
        },

        providers = {
          buffer = {
            name = "Buffer",
            module = "blink.cmp.sources.buffer",
            score_offset = -3,
          },
          codeium = {
            name = "codeium",
            module = "blink.compat.source",
            score_offset = 3,
          },
        },
      },
    },
  },
}
