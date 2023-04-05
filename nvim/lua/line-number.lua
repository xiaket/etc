function relativeln(target)
	if vim.b.lnstatus == nil then
		vim.b.lnstatus = "number"
	end

	if vim.b.lnstatus ~= "nonumber" then
		if target == "number" then
			vim.o.number = true
			vim.o.relativenumber = false
		else
			vim.o.number = true
			vim.o.relativenumber = true
		end
	else
		vim.o.number = false
	end
end

-- Show relative line number when in command mode and absolute line number in edit mode
local _group = vim.api.nvim_create_augroup("LineNumber", { clear = true })
vim.api.nvim_create_autocmd("InsertEnter", {
	pattern = "*",
	callback = function()
		relativeln("number")
	end,
	once = true,
	group = _group,
})
vim.api.nvim_create_autocmd("InsertLeave", {
	pattern = "*",
	callback = function()
		relativeln("relativenumber")
	end,
	once = true,
	group = _group,
})
vim.api.nvim_create_autocmd("FocusLost", {
	pattern = "*",
	callback = function()
		relativeln("number")
	end,
	once = true,
	group = _group,
})
vim.api.nvim_create_autocmd("CursorMoved", {
	pattern = "*",
	callback = function()
		relativeln("relativenumber")
	end,
	once = true,
	group = _group,
})

function toggleln()
	if vim.b.lnstatus == nil then
		vim.b.lnstatus = "number"
	end

	if vim.b.lnstatus == "number" then
		vim.o.number = false
		vim.o.relativenumber = false
		vim.b.lnstatus = "nonumber"
	else
		vim.o.number = true
		vim.o.relativenumber = true
		vim.b.lnstatus = "number"
	end
end

-- Use Ctrl-L to toggle the line number display.
vim.api.nvim_set_keymap(
	"",
	"<C-L>",
	':lua toggleln()<CR>:lua require"gitsigns".toggle_signs()<CR>',
	{ noremap = true, silent = true }
)
