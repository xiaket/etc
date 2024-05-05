local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"

if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "--single-branch",
    "https://github.com/folke/lazy.nvim.git",
    lazypath,
  })
end
vim.opt.runtimepath:prepend(lazypath)

vim.g.mapleader = ","

require("lazy").setup("packages", {
  defaults = { lazy = true },
  install = { colorscheme = { "nightfox" } },
  change_detection = {
    notify = false,
  },
  performance = {
    rtp = {
      disabled_plugins = {
        "gzip",
        "man",
        "matchit",
        "matchparen",
        "netrwPlugin",
        "osc52",
        "rplugin",
        "shada",
        "spellfile",
        "tarPlugin",
        "tohtml",
        "tutor",
        "zipPlugin",
      },
    },
  },
})

local function requiref(module)
  require(module)
end

if pcall(requiref, "nightfox") then
  vim.cmd("colorscheme nightfox")
end

require("flags")
require("keymaps")
require("line-number")
require("auto-header")
