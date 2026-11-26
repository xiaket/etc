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
  {
    "maxandron/goplements.nvim",
    ft = "go",
    opts = {},
  },
  {
    "hashivim/vim-terraform",
    ft = "terraform",
  },
  {
    "rhysd/vim-gfm-syntax",
    ft = "markdown",
  },
  -- Load by cmd
  {
    "xiaket/w.nvim",
    cmd = { "WToggleExplorer", "WSplitLeft", "WSplitRight", "WSplitUp", "WSplitDown" },
    event = "BufEnter",
    opts = {
      explorer = {
        window_width = 30,
      },
    },
  },
  -- Load when BufWritePre
  {
    "stevearc/conform.nvim",

    event = { "BufWritePre" },
    opts = {
      -- Define your formatters
      formatters_by_ft = {
        lua = { "stylua" },
        python = { "black", "ruff_fix" },
        sh = { "shfmt" },
        rust = { "rustfmt" },
        c = { "clang-format" },
      },
      -- Set default options
      default_format_opts = {
        lsp_format = "fallback",
      },
      -- Set up format-on-save
      format_on_save = function(bufnr)
        -- Check only the buffer-local variable
        if vim.b[bufnr].conform_disable_autoformat then
          -- Return nothing to disable autoformat
          return
        end
        return { timeout_ms = 1500 }
      end,
      -- Customize formatters
      formatters = {
        shfmt = {
          prepend_args = { "--indent", "2", "--case-indent", "--space-redirects" },
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
      require("mini.jump2d").setup()
      require("mini.comment").setup()
      require("mini.cursorword").setup()
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
    branch = "main",
    lazy = false,
    build = ":TSUpdate",
    config = function()
      require("nvim-treesitter").install({ "python", "bash", "go", "json", "lua", "rust", "yaml" })
      vim.api.nvim_create_autocmd("FileType", {
        pattern = { "python", "sh", "go", "json", "lua", "rust", "yaml" },
        callback = function(ev)
          if not pcall(vim.treesitter.start, ev.buf) then
            return
          end
          vim.bo[ev.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
        end,
      })
    end,
  },

  -- LSP
  {
    "williamboman/mason.nvim",
    dependencies = { "williamboman/mason-lspconfig.nvim" },
    event = "VeryLazy",
    config = function()
      require("mason").setup()
      require("mason-lspconfig").setup({
        ensure_installed = {
          "bashls",
          "docker_compose_language_service",
          "dockerls",
          "gopls",
          "lua_ls",
          "pyright",
          "taplo",
          "terraformls",
        },
        automatic_installation = true,
      })
    end,
  },
  {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = {
      "saghen/blink.cmp",
      "williamboman/mason.nvim",
      "williamboman/mason-lspconfig.nvim",
    },
    config = function()
      local capabilities = require("blink.cmp").get_lsp_capabilities()

      -- Auto-configured servers with default settings
      local auto_servers = {
        "bashls",
        "docker_compose_language_service",
        "dockerls",
        "gopls",
        "taplo",
        "terraformls",
      }

      for _, server in ipairs(auto_servers) do
        vim.lsp.config(server, { capabilities = capabilities })
        vim.lsp.enable(server)
      end

      -- starpls for Bazel/Starlark
      vim.lsp.config("starpls", {
        capabilities = capabilities,
        filetypes = { "bzl", "BUILD", "bazel" },
      })
      vim.lsp.enable("starpls")

      -- lua_ls custom config
      vim.lsp.config("lua_ls", {
        capabilities = capabilities,
        settings = {
          Lua = {
            diagnostics = { globals = { "vim" } },
            completion = { callSnippet = "Replace" },
          },
        },
      })
      vim.lsp.enable("lua_ls")

      -- pyright custom config with uv's standard .venv layout
      vim.lsp.config("pyright", {
        capabilities = capabilities,
        before_init = function(_, config)
          local root = vim.fs.root(config.root_dir or vim.fn.getcwd(), ".venv")
          local venv = root and vim.fs.joinpath(root, ".venv") or vim.env.VIRTUAL_ENV
          if venv then
            local python = vim.fs.joinpath(venv, "bin", "python")
            if vim.fn.executable(python) == 1 then
              config.settings.python.pythonPath = python
            end
          end
        end,
        settings = {
          pyright = { autoImportCompletion = true },
          python = {
            analysis = {
              autoSearchPaths = true,
              diagnosticMode = "openFilesOnly",
              useLibraryCodeForTypes = true,
              typeCheckingMode = "off",
            },
          },
        },
      })
      vim.lsp.enable("pyright")
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
    "saghen/blink.cmp",
    dependencies = {
      "rafamadriz/friendly-snippets",
    },
    lazy = false,
    version = "*", -- use a release tag to download pre-built binaries
    opts = {
      -- Press tab to select and enter to accept, shift tab to reverse.
      keymap = {
        preset = "enter",
        ["<Tab>"] = {
          function(cmp)
            if cmp.snippet_active() then
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
      completion = {
        accept = {
          auto_brackets = { enabled = false },
        },
      },
      signature = { enabled = true },
      cmdline = {
        keymap = {
          preset = "enter",
          ["<CR>"] = { "select_accept_and_enter", "fallback" },
        },
      },
      sources = {
        default = { "lsp", "path", "snippets", "buffer" },

        providers = {
          buffer = {
            name = "Buffer",
            module = "blink.cmp.sources.buffer",
            score_offset = -3,
          },
          snippets = {
            name = "snippets",
            module = "blink.cmp.sources.snippets",
            score_offset = 6,
          },
        },
      },
    },
  },
}
