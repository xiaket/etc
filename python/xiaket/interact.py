#!/usr/bin/env python
# encoding=utf8
import os

from prompt_toolkit.keys import Keys
from prompt_toolkit.utils import DummyContext
from ptpython.repl import PythonRepl


def shell(globals_, locals_):
    """
    Customized pypython.repl.
    """
    # Create REPL.
    repl = PythonRepl(
        get_globals=lambda : globals_,
        get_locals=lambda : locals_,
        history_filename=os.path.expanduser("~/.pyhistory.shell"),
    )
    repl.confirm_exit = True
    repl.prompt_style = 'ipython'
    repl.use_code_colorscheme("monokai")

    @repl.add_key_binding(Keys.ControlD)
    def _(event):
        """
        Ctrl-D to exit.

        This behavior is suppressed somewhere in ptpython.
        """
        event.app.exit(exception=EOFError, style='class:exiting')

    with DummyContext():
        repl.run()
