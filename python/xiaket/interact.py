#!/usr/bin/env python
# encoding=utf8
import os

from prompt_toolkit.utils import DummyContext
from ptpython.repl import PythonRepl
from ptpython.eventloop import create_eventloop as eventloop
from ptpython.python_input import PythonCommandLineInterface


def shell(globals_, locals_):
    """
    Customized pypython.repl.
    """
    # Create REPL.
    repl = PythonRepl(
        lambda : globals_, lambda : locals_,
        history_filename=os.path.expanduser("~/.pyhistory.shell")
    )

    # Some customizations
    repl.show_exit_confirmation = False
    repl.show_sidebar = False
    repl.confirm_exit = False
    repl.prompt_style = 'ipython'
    repl.use_code_colorscheme("monokai")

    cli = PythonCommandLineInterface(python_input=repl, eventloop=eventloop())

    # Start repl.
    with DummyContext():
        cli.run()
