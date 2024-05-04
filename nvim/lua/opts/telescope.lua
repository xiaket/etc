local actions = require("telescope.actions")
local previewers = require("telescope.previewers")

local peeker = function(filepath, bufnr, opts)
  -- No preview if larger than 100k
  opts = opts or {}

  filepath = vim.fn.expand(filepath)
  vim.loop.fs_stat(filepath, function(_, stat)
    if not stat then
      return
    end
    if stat.size > 100000 then
      return
    else
      previewers.buffer_previewer_maker(filepath, bufnr, opts)
    end
  end)
end

require("telescope").setup({
  defaults = {
    buffer_previewer_maker = peeker,
    mappings = {
      i = {
        ["<esc>"] = actions.close,
      },
    },
    fzf = {
      fuzzy = true,
      override_generic_sorter = true, -- override the generic sorter
      override_file_sorter = true, -- override the file sorter
    },
  },
})
require("telescope").load_extension("fzf")
