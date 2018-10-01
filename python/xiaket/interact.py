#!/usr/bin/env python
# encoding=utf8
import os

from prompt_toolkit.utils import DummyContext
from ptpython.repl import PythonRepl, run_config


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
    run_config(repl)

    with DummyContext():
        repl.run()
