#!/usr/bin/env python
# encoding=utf8

from __future__ import unicode_literals


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
    repl.prompt_style = 'ipython'
    repl.true_color = True
    repl.use_code_colorscheme('monokai')

    # typo fixer.
    corrections = {
        'impotr': 'import',
        'pritn': 'print',
    }
