local cmp = require("cmp")
local luasnip = require("luasnip")

local has_words_before = function()
  local line, col = unpack(vim.api.nvim_win_get_cursor(0))
  return col ~= 0
    and vim.api.nvim_buf_get_lines(0, line - 1, line, true)[1]:sub(col, col):match("%s") == nil
end
local function get_date(_, _, format)
  return os.date(format)
end

local lspkind = require('lspkind')
local source_mapping = {
	buffer = "[Buffer]",
	nvim_lsp = "[LSP]",
	nvim_lua = "[Lua]",
	cmp_tabnine = "[TN]",
	path = "[Path]",
}

cmp.setup({
  snippet = {
    expand = function(args)
      luasnip.lsp_expand(args.body)
    end,
  },
  mapping = {
    ["<CR>"] = cmp.mapping.confirm({ select = true }),
    ["<Tab>"] = cmp.mapping(function(fallback)
      if cmp.visible() then
        cmp.select_next_item()
      elseif luasnip.expand_or_jumpable() then
        luasnip.expand_or_jump()
      elseif has_words_before() then
        cmp.complete()
      else
        fallback()
      end
    end, { "i", "s" }),
  },
  sources = {
    { name = "cmp_tabnine" },
    { name = "nvim_lsp" },
    { name = "nvim_lua" },
    { name = "path" },
    { name = "buffer" },
    { name = "luasnip" },
  },
	formatting = {
		format = function(entry, vim_item)
			-- if you have lspkind installed, you can use it like
			-- in the following line:
	 		vim_item.kind = lspkind.symbolic(vim_item.kind, {mode = "symbol"})
	 		vim_item.menu = source_mapping[entry.source.name]
	 		if entry.source.name == "cmp_tabnine" then
	 			local detail = (entry.completion_item.data or {}).detail
	 			vim_item.kind = ""
	 			if detail and detail:find('.*%%.*') then
	 				vim_item.kind = vim_item.kind .. ' ' .. detail
	 			end

	 			if (entry.completion_item.data or {}).multiline then
	 				vim_item.kind = vim_item.kind .. ' ' .. '[ML]'
	 			end
	 		end
	 		local maxwidth = 80
	 		vim_item.abbr = string.sub(vim_item.abbr, 1, maxwidth)
	 		return vim_item
	  end,
	},
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

-- Setup lspconfig.
local venv = get_python_venv()
require("lspconfig").pylsp.setup({
  capabilities = require("cmp_nvim_lsp").default_capabilities(
    vim.lsp.protocol.make_client_capabilities()
  ),
  settings = {
    cmd = { "pylsp", "-v" },
    cmd_env = { VIRTUAL_ENV = venv, PATH = venv .. "/bin:" .. vim.env.PATH },
    pylsp = {
      plugins = {
        autopep8 = { enabled = false },
        mccabe = { enabled = false },
        pydocstyle = { enabled = true },
        pylint = { enabled = false },
      },
    },
  },
})

local cmp_autopairs = require("nvim-autopairs.completion.cmp")
cmp.event:on("confirm_done", cmp_autopairs.on_confirm_done({ map_char = { tex = "" } }))

local tabnine = require('cmp_tabnine.config')

tabnine:setup({
	max_lines = 1000,
	max_num_results = 10,
	sort = true,
	run_on_every_keystroke = true,
	snippet_placeholder = '9',
	show_prediction_strength = false
})

