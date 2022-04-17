local cmp = require("cmp")
local luasnip = require("luasnip")

local has_words_before = function()
	local line, col = unpack(vim.api.nvim_win_get_cursor(0))
	return col ~= 0 and vim.api.nvim_buf_get_lines(0, line - 1, line, true)[1]:sub(col, col):match("%s") == nil
end
local function get_date(_, _, format)
	return os.date(format)
end

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
		{ name = "nvim_lsp" },
		{ name = "path" },
		{ name = "buffer" },
		{ name = "luasnip" },
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
	capabilities = require("cmp_nvim_lsp").update_capabilities(vim.lsp.protocol.make_client_capabilities()),
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
