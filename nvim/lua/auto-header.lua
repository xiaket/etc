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

local _group = vim.api.nvim_create_augroup("AutoHeader", { clear = true })
vim.api.nvim_create_autocmd("BufNewFile", {pattern = {"*.sh", "*.py"}, callback = add_header, once = true, group=_group})
