#!/usr/bin/env python
"""
Manage directory/soft links used in this repo.
"""
import argparse
import json
import os
import subprocess
from string import Template


def render(raw, vars_):
    return os.path.expanduser(Template(raw).substitute(vars_))

def build_go(src, dst):
    if os.access(dst, os.X_OK) and os.stat(src).st_mtime < os.stat(dst).st_mtime:
        # dst exists and src is older than dst, meaning src is not changed
        # after last dst build, in this case, we can skip the build.
        return
    print(f"Building: {src}")
    subprocess.run(["go", "build", "-o", dst, src])


def ensure_dirs(spec):
    for _dir in spec["dirs"]:
        path = render(_dir, spec["vars"])
        if not os.path.isdir(path):
            print(f"creating dir: {path}")
            os.makedirs(path)

def ensure_links(spec):
    def create_link(src, dst, vars_):
        src, dst = render(src, vars_), render(dst, vars_)
        if not os.path.islink(dst):
            print(f"creating link: {src} -> {dst}")
            os.symlink(src, dst)

    for link_spec in spec["links"]:
        if isinstance(link_spec['dst'], list):
            for dst in link_spec['dst']:
                create_link(link_spec['src'], dst, spec["vars"])
        else:
            create_link(link_spec['src'], link_spec['dst'], spec["vars"])

def ensure_builds(spec):
    for build_spec in spec["builds"]:
        src = render(build_spec['src'], spec["vars"])
        dst = render(build_spec['dst'], spec["vars"])
        if build_spec['lang'] == "go":
            build_go(src, dst)


def main():
    parser = argparse.ArgumentParser(usage="%(prog)s [file]")
    parser.add_argument("config", help="Action to take", type=open)
    parsed = parser.parse_args()
    specification = json.loads(parsed.config.read())
    ensure_dirs(specification)
    ensure_links(specification)
    ensure_builds(specification)


if __name__ == "__main__":
    main()
