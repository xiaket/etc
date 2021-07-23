local luasnip = require'luasnip'

local function bash(_, command)
	local file = io.popen(command, "r")
	local res = {}
	for line in file:lines() do
		table.insert(res, line)
	end
	return res
end

luasnip.snippets = {
	all = {
    luasnip.snippet("dtime", luasnip.function_node(bash, {}, "date +'%Y-%m-%d %H:%M'")),
    luasnip.snippet("date", luasnip.function_node(bash, {}, "date +'%Y-%m-%d'")),
	},
  python = {
    luasnip.snippet("exit", luasnip.text_node({"import sys", "sys.exit()"})),
    luasnip.snippet("interact", luasnip.text_node({"from xiaket.interact import shell", "shell(globals(), locals())"})),
    luasnip.snippet("datetime", luasnip.text_node({"from datetime import datetime"})),
    luasnip.snippet("ifmain", luasnip.text_node({"if __name__ == '__main__':", "    main()"})),
  }
}
