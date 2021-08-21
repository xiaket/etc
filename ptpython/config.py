#!/usr/bin/env python
# encoding=utf8


def configure(repl):
    """
    Configuration method. This is called during the start-up of ptpython.
    :param repl: `PythonRepl` instance.
    """
    # Disable these features
    repl.confirm_exit = False
    repl.enable_open_in_editor = False

    # visual
    repl.highlight_matching_parenthesis = True
    repl.insert_blank_line_after_output = False
    repl.prompt_style = "ipython"
    repl.color_depth = "DEPTH_24_BIT"
    repl.use_code_colorscheme("zenburn")

    # typo fixer.
    corrections = {
        "impotr": "import",
        "pritn": "print",
    }
