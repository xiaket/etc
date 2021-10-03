-- plugin setups

-- start:nvim-treesitter
require'nvim-treesitter.configs'.setup {
  ensure_installed = {"python", "bash", "go", "json", "lua", "yaml"},
  highlight = {
    enable = true,
    additional_vim_regex_highlighting = false,
  },
  indent = {
    enable = true,
    disable = {"python"},
  }
}
-- end:nvim-treesitter

-- start:nvim-lspconfig
vim.api.nvim_set_keymap('n', 'gD', '<cmd>lua vim.lsp.buf.declaration()<cr>', {noremap = true, silent = false})
vim.api.nvim_set_keymap('n', 'gd', '<cmd>lua vim.lsp.buf.definition()<cr>', {noremap = true, silent = false})
-- end:nvim-lspconfig

-- start:telescope.nvim
local actions = require('telescope.actions')
local previewers = require('telescope.previewers')

local peeker = function(filepath, bufnr, opts)
  -- No preview if larger than 100k
  opts = opts or {}

  filepath = vim.fn.expand(filepath)
  vim.loop.fs_stat(filepath, function(_, stat)
    if not stat then return end
    if stat.size > 100000 then
      return
    else
      previewers.buffer_previewer_maker(filepath, bufnr, opts)
    end
  end)
end

require('telescope').setup{
  defaults = {
    buffer_previewer_maker = peeker,
    mappings = {
      i = {
        ["<esc>"] = actions.close
      },
    },
    fzf = {
      fuzzy = true,                    -- false will only do exact matching
      override_generic_sorter = true,  -- override the generic sorter
      override_file_sorter = true,     -- override the file sorter
    }
  }
}
vim.api.nvim_set_keymap('n', '<leader>f', ':Telescope find_files<cr>', {noremap = true, silent = false})
vim.api.nvim_set_keymap('n', '<leader>g', ':Telescope live_grep<cr>', {noremap = true, silent = false})
-- end:telescope.nvim

-- start:telescope-fzf-native.nvim
require('telescope').load_extension('fzf')
-- end:telescope-fzf-native.nvim

-- start:nvim-autopairs
require('nvim-autopairs').setup()
-- end:nvim-autopairs

-- start:luasnip
local luasnip = require("luasnip")
-- end:luasnip

-- start:nvim-cmp
---- This section is coupled with nvim-autopairs and luasnip.
vim.o.completeopt = "menu,menuone,noselect"
local cmp = require'cmp'

local termcode = function(str)
  return vim.api.nvim_replace_termcodes(str, true, true, true)
end

local check_back_space = function()
    local col = vim.fn.col('.') - 1
    return col == 0 or vim.fn.getline('.'):sub(col, col):match('%s')
end

cmp.setup({
  mapping = {
    ['<CR>'] = cmp.mapping.confirm({ select = true }),
  },
  sources = {
    { name = 'nvim_lsp' },
    { name = 'luasnip' },
    { name = 'buffer' },
  },
  snippet = {
    expand = function(args)
      require('luasnip').lsp_expand(args.body)
    end,
  }
})

_G.tab_complete = function()
  if vim.fn.pumvisible() == 1 then
    return termcode "<C-n>"
  elseif luasnip.expand_or_jumpable() then
    return luasnip.jump()
  elseif check_back_space() then
    return termcode "<Tab>"
  else
    return cmp.mapping.complete()
  end
end

-- cmp keymaps setup
vim.api.nvim_set_keymap("i", "<Tab>", "v:lua.tab_complete()", {expr = true})

require("nvim-autopairs.completion.cmp").setup({
  map_cr = true,
  map_complete = true,
  auto_select = true,
  insert = false,
  map_char = {
    all = '(',
    tex = '{'
  }
})

local get_python_venv = function()
  if vim.env.VIRTUAL_ENV then
    return vim.env.VIRTUAL_ENV
  end

  local cwd = vim.fn.getcwd()
  while true do
    if cwd == "/" then
      break
    end

    local match = vim.fn.glob(cwd, 'Venv')
    if match ~= '' then
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

-- Setup lspconfig.
local venv = get_python_venv()
require('lspconfig').pylsp.setup {
  on_attach = on_attach_vim,
  capabilities = require('cmp_nvim_lsp').update_capabilities(vim.lsp.protocol.make_client_capabilities()),
  settings = {
    cmd = {"pylsp", "-v"},
    cmd_env = {VIRTUAL_ENV = venv, PATH = venv .. "/bin:" .. vim.env.PATH},
    pylsp = {
      plugins = {
        autopep8 = { enabled = false },
        mccabe = { enabled = false },
        pycodestyle = { enabled = true },
        pyflakes = { enabled = false },
        pylint = { enabled = false },
      }
    }
  }
}
-- end:nvim-cmp

--- start:nightforx.nvim
require('nightfox').load()

--- start:lualine.nvim
require'lualine'.setup {
  options = {
    icons_enabled = false,
    theme = 'nightfox',
  },
  sections = {
    lualine_b = {},
    lualine_x = {'encoding', 'fileformat'},
  }
}
--- end:lualine.nvim

-- start:gitsigns.nvim
require('gitsigns').setup()
-- end:gitsigns.nvim

-- start:formatter.nvim
require('formatter').setup({
  logging = false,
  filetype = {
    python = {
       function()
          return {
            exe = "black",
            args = {"--line-length", "100"},
            stdin = false
          }
       end
    },
    yaml = {
       function()
          return {
            exe = "yamlfix",
            stdin = false
          }
       end
    },
  }
})
vim.api.nvim_set_keymap('n', '<C-F>', ':Format<cr>', {noremap = true, silent = true})
-- end:formatter.nvim

-- start:spellsitter.nvim
require('spellsitter').setup {
  hl = 'SpellBad',
  captures = {'comment', 'string'},
}
-- end:spellsitter.nvim

-- start:focus.nvim
require("focus").setup(
  {
    hybridnumber = true,
    excluded_filetypes = {"toggleterm"}
  }
)
-- moving around in windows
vim.api.nvim_set_keymap('n', '<A-h>', '<C-W>h', {noremap = true})
vim.api.nvim_set_keymap('n', '<A-l>', '<C-W>l', {noremap = true})
vim.api.nvim_set_keymap('n', '<A-j>', '<C-W>j', {noremap = true})
vim.api.nvim_set_keymap('n', '<A-k>', '<C-W>k', {noremap = true})
vim.api.nvim_set_keymap('n', '<leader>h', ':FocusSplitLeft<cr>', { silent = true })
vim.api.nvim_set_keymap('n', '<leader>j', ':FocusSplitDown<cr>', { silent = true })
vim.api.nvim_set_keymap('n', '<leader>k', ':FocusSplitUp<cr>', { silent = true })
vim.api.nvim_set_keymap('n', '<leader>l', ':FocusSplitRight<cr>', { silent = true })
-- end:focus.nvim

-- start:auto-session
vim.o.sessionoptions="blank,buffers,curdir,folds,help,tabpages,winsize,resize,winpos,terminal"
require('auto-session').setup {
    auto_session_enable_last_session=true,
}
-- end:auto-session
