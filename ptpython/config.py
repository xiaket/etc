#!/usr/bin/env python
# encoding=utf8
from prompt_toolkit.keys import Keys


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

    @repl.add_key_binding(Keys.ControlD)
    def _(event):
        """
        Ctrl-D to exit.

        This behavior is suppressed somewhere in ptpython.
        """
        event.app.exit(exception=EOFError, style='class:exiting')

    # typo fixer.
    corrections = {
        'impotr': 'import',
        'pritn': 'print',
    }
