local install_path = vim.fn.stdpath("data") .. "/site/pack/packer/opt/packer.nvim"
if vim.fn.empty(vim.fn.glob(install_path)) > 0 then
	vim.api.nvim_command("!git clone https://github.com/wbthomason/packer.nvim " .. install_path)
	vim.cmd([[ packadd packer.nvim ]])
end

require("packer").startup(function(use)
	-------------------------------------
	-- Lazy load following plugins:
	-------------------------------------

	-- Load by filetype
	use({
		"ekalinin/Dockerfile.vim",
		ft = { "Dockerfile" },
	})
	use({ -- go support.
		"fatih/vim-go",
		ft = "go",
	})
	use({
		"hashivim/vim-terraform",
		ft = "terraform",
	})
	use({
		"rhysd/vim-gfm-syntax",
		ft = "markdown",
	})
	use({
		"Vimjas/vim-python-pep8-indent",
		ft = "python",
	})

	-- Load by cmd
	use({ -- easier split management.
		"beauwilliams/focus.nvim",
		cmd = { "FocusSplitLeft", "FocusSplitDown", "FocusSplitUp", "FocusSplitRight" },
		config = function()
			require("focus").setup({ hybridnumber = true })
		end,
	})
	use({
		"dstein64/vim-startuptime",
		cmd = "StartupTime",
	})
	use({ -- format files
		"lukas-reineke/lsp-format.nvim",
		cmd = { "Format" },
		config = function()
			require("lsp-format").setup({
				["*"] = {
					{ cmd = { "gsed -i 's/[ \t]*$//'" } }, -- remove trailing whitespace
				},
				python = {
					{ cmd = { "black --line-length 100" } },
				},
				bash = {
					{ cmd = { "shfmt -w" } },
				},
				yaml = {
					{ cmd = { "yamlfix" } },
				},
				lua = {
					{ cmd = { "stylua" } },
				},
			})
			require("lspconfig").gopls.setup({ on_attach = require("lsp-format").on_attach })
		end,
	})

	-- Load when BufRead
	use({ -- highlight todo comments.
		"folke/todo-comments.nvim",
		event = "BufRead",
		requires = "nvim-lua/plenary.nvim",
		config = function()
			require("todo-comments").setup({})
		end,
	})
	use({ -- show lsp errors in a buffer.
		"folke/trouble.nvim",
		event = "BufRead",
		requires = "kyazdani42/nvim-web-devicons",
		config = function()
			require("trouble").setup()
		end,
	})
	use({ -- show git change statuses.
		"lewis6991/gitsigns.nvim",
		config = function()
			require("gitsigns").setup()
		end,
		event = "BufRead",
	})
	use({ -- spell check setup
		"lewis6991/spellsitter.nvim",
		event = "BufRead",
		config = function()
			require("spellsitter").setup({
				hl = "SpellBad",
				captures = { "comment", "string" },
			})
		end,
	})
	use({ -- stabilize buffer on windows size changes.
		"luukvbaal/stabilize.nvim",
		event = "BufRead",
		config = function()
			require("stabilize").setup()
		end,
	})
	use({ -- visualize undos
		"mbbill/undotree",
		event = "BufRead",
	})
	use({ -- replace vimscript version of matchparen
		"monkoose/matchparen.nvim",
		event = "BufRead",
		config = function()
			require("matchparen").setup()
		end,
	})
	use({ -- better :term.
		"numtostr/FTerm.nvim",
		event = "BufRead",
		config = function()
			require("FTerm").setup()
		end,
	})
	use({
		"nvim-lualine/lualine.nvim",
		requires = { "kyazdani42/nvim-web-devicons", opt = true },
		event = "BufRead",
		config = function()
			require("lualine").setup({
				options = { theme = "nightfox" },
				sections = {
					lualine_b = {},
					lualine_x = { "encoding", "fileformat" },
				},
			})
		end,
	})
	use({ -- telescope
		"nvim-telescope/telescope-fzf-native.nvim",
		after = "telescope.nvim",
		requires = {
			{
				"nvim-telescope/telescope.nvim",
				requires = { "nvim-lua/plenary.nvim" },
				event = "BufRead",
			},
		},
		event = "BufRead",
		run = "make",
		config = [[require('opts.telescope')]],
	})

	-------------------------------------
	-- Other plugins
	-------------------------------------
	use({ -- manage packer
		"wbthomason/packer.nvim",
		opt = true,
		cmd = { "PackerCompile", "PackerSync" },
	})

	use({ -- treesitter
		"nvim-treesitter/nvim-treesitter",
		run = ":TSUpdate",
		config = function()
			require("nvim-treesitter").setup({
				ensure_installed = { "python", "bash", "go", "json", "lua", "yaml" },
				highlight = { enable = true, additional_vim_regex_highlighting = false },
				indent = { enable = true, disable = { "python" } },
			})
		end,
	})

	-- cmp & friends
	use({
		"hrsh7th/nvim-cmp",
		requires = {
			{ "hrsh7th/cmp-buffer", after = "nvim-cmp" },
			"hrsh7th/cmp-nvim-lsp",
			{ "hrsh7th/cmp-path", after = "nvim-cmp" },
			{ "hrsh7th/cmp-nvim-lua", after = "nvim-cmp" },
			{ "saadparwaiz1/cmp_luasnip", after = "nvim-cmp" },
		},
		after = { "nvim-lspconfig", "LuaSnip" },
		config = [[require('opts.cmp')]],
	})
	use({
		"L3MON4D3/LuaSnip",
		config = function()
			require("opts.snippets")
		end,
	})
	use({ "neovim/nvim-lspconfig" })
	use({
		"ray-x/lsp_signature.nvim",
		config = function()
			require("lsp_signature").setup()
		end,
		after = "nvim-lspconfig",
	})
	use({
		"windwp/nvim-autopairs",
		config = function()
			require("nvim-autopairs").setup({})
		end,
	})

	-- speedup
	use("lewis6991/impatient.nvim")

	-- theme
	use("EdenEast/nightfox.nvim")
end)

-- auto compile changes in this file.
vim.api.nvim_create_augroup("Packer", { clear = true })
vim.api.nvim_create_autocmd(
	"BufWritePost",
	{ pattern = "packages.lua", command = "PackerCompile", once = true, group = "Packer" }
)
