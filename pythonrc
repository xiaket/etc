import rlcompleter
import sys

try:
    import gnureadline as readline
    has_readline = True
except ImportError:
    try:
        import readline
        has_readline = True
    except ImportError:
        has_readline = False


if has_readline:
    import atexit
    import os

    HISTORYPATH = os.path.expanduser("~/.pyhistory")
    if not os.path.isfile(HISTORYPATH):
        open(HISTORYPATH, 'w').close()
    readline.parse_and_bind('tab:complete')

    def save_history(history_file):
        try:
            import gnureadline as readline
        except ImportError:
            import readline
        readline.write_history_file(history_file)

    readline.read_history_file(HISTORYPATH)
    atexit.register(save_history, HISTORYPATH)

    del atexit, os, readline, has_readline, save_history, HISTORYPATH

class ColorChanger(object):
    def __init__(self):
        self.color = self

    def __call__(self, value):
        import random
        import sys
        if value != None:
            print(value)
        choices = [31, 32, 33, 34, 35, 36, 37, 92, 93, 96]
        choice = random.choice(choices)
        sys.ps1 = '\001\033[' + str(choice) + 'm\002>\001\033[0m\002 '
        sys.ps2 = '  '
        del random, sys


sys.displayhook = ColorChanger()

sys.ps1 = '> '
sys.ps2 = '  '

del rlcompleter, ColorChanger, sys
