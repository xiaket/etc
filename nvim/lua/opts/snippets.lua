local luasnip = require("luasnip")

local function get_date(_, _, format)
  return os.date(format)
end

luasnip.add_snippets("all", {
  luasnip.snippet(
    "dtime",
    luasnip.function_node(get_date, {}, { user_args = { "%Y-%m-%d %H:%M" } })
  ),
  luasnip.snippet("date", luasnip.function_node(get_date, {}, { user_args = { "%Y-%m-%d" } })),
}, { key = "all" })

luasnip.add_snippets("python", {
  luasnip.snippet("exit", luasnip.text_node({ "import sys", "sys.exit()" })),
  luasnip.snippet(
    "shell",
    luasnip.text_node({
      "xiaket = locals()",
      "import os",
      "import logging",
      "logging.getLogger('parso').setLevel(logging.INFO)",
      "from prompt_toolkit.utils import DummyContext",
      "from ptpython.repl import PythonRepl, run_config",
      "repl = PythonRepl(get_globals=lambda : globals(), get_locals=lambda : xiaket, history_filename=os.path.expanduser('~/.ptpython_history'))",
      "run_config(repl)",
      "with DummyContext():",
      "    repl.run()",
    })
  ),
  luasnip.snippet("ifmain", luasnip.text_node({ "if __name__ == '__main__':", "    main()" })),
}, { key = "python" })
