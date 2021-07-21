Headers = {
  py = {"#!/usr/bin/env python3", "", ""},
  sh = {"#!/bin/bash", "", "set -o errexit", "set -o nounset", "set -o pipefail", "", ""},
}

function add_header()
  filetype = vim.fn.expand('%:e')
  if Headers[filetype] ~= nil then
    vim.fn.setline(".", Headers[filetype])
  end
end

vim.cmd('autocmd BufNewFile * :lua add_header()')
