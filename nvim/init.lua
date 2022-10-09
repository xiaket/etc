function opt_load(module)
    -- return whether the module has been loaded.
    local function requiref(module)
        require(module)
    end
    res = pcall(requiref,module)
    return res
end

-- Speed up config loading.
opt_load("impatient")

-- plugins
require("packages")

-- generic vim configurations
require("flags")

-- keymaps
require("keymaps")

-- my line number setup
require("line-number")

-- auto header: add a header to new python/shell scripts
require("auto-header")
