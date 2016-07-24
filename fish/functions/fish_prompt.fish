# prompt largely based on bobthefish
#
#     set -g theme_git_worktree_support yes
#     set -g theme_display_docker_machine no

# ===========================
# Helper methods
# ===========================

function __bobthefish_git_branch -S -d 'Get the current git branch (or commitish)'
  set -l ref (command git symbolic-ref HEAD ^/dev/null)
  if [ $status -gt 0 ]
    set -l branch (command git show-ref --head -s --abbrev | head -n1 ^/dev/null)
    set ref "$__bobthefish_detached_glyph $branch"
  end
  echo $ref | sed "s#refs/heads/#$__bobthefish_branch_glyph #"
end

function __bobthefish_pretty_parent -S -a current_dir -d 'Print a parent directory, shortened to fit the prompt'
  echo -n (dirname $current_dir) | sed -e 's#/private##' -e "s#^$HOME#~#" -e 's#/\(\.\{0,1\}[^/]\)\([^/]*\)#/\1#g' -e 's#/$##'
end

function __bobthefish_git_project_dir -S -d 'Print the current git project base directory'
  if [ "$theme_git_worktree_support" != 'yes' ]
    command git rev-parse --show-toplevel ^/dev/null
    return
  end

  set -l git_dir (command git rev-parse --git-dir ^/dev/null); or return

  pushd $git_dir
  set git_dir $PWD
  popd

  switch $PWD/
    case $git_dir/\*
      # Nothing works quite right if we're inside the git dir
      # TODO: fix the underlying issues then re-enable the stuff below

      # # if we're inside the git dir, sweet. just return that.
      # set -l toplevel (command git rev-parse --show-toplevel ^/dev/null)
      # if [ "$toplevel" ]
      #   switch $git_dir/
      #     case $toplevel/\*
      #       echo $git_dir
      #   end
      # end
      return
  end

  set -l project_dir (dirname $git_dir)

  switch $PWD/
    case $project_dir/\*
      echo $project_dir
      return
  end

  set project_dir (command git rev-parse --show-toplevel ^/dev/null)
  switch $PWD/
    case $project_dir/\*
      echo $project_dir
  end
end

function __bobthefish_project_pwd -S -a current_dir -d 'Print the working directory relative to project root'
  echo "$PWD" | sed -e "s#$current_dir##g" -e 's#^/##'
end

function __bobthefish_git_ahead -S -d 'Print the ahead/behind state for the current branch'
  command git rev-list --left-right '@{upstream}...HEAD' ^/dev/null | awk '/>/ {a += 1} /</ {b += 1} {if (a > 0 && b > 0) nextfile} END {if (a > 0 && b > 0) print "±"; else if (a > 0) print "+"; else if (b > 0) print "-"}'
end

# ===========================
# Segment functions
# ===========================

function __bobthefish_start_segment -S -d 'Start a prompt segment'
  set -l bg $argv[1]
  set -e argv[1]
  set -l fg $argv[1]
  set -e argv[1]

  set_color normal # clear out anything bold or underline...
  set_color -b $bg
  set_color $fg $argv

  switch "$__bobthefish_current_bg"
    case ''
      # If there's no background, just start one
      echo -n ' '
    case "$bg"
      # If the background is already the same color, draw a separator
      echo -ns $__bobthefish_right_arrow_glyph ' '
    case '*'
      # otherwise, draw the end of the previous segment and the start of the next
      set_color $__bobthefish_current_bg
      echo -ns $__bobthefish_right_black_arrow_glyph ' '
      set_color $fg $argv
  end

  set __bobthefish_current_bg $bg
end

function __bobthefish_path_segment -S -a current_dir -d 'Display a shortened form of a directory'
  set -l segment_color $__color_path
  set -l segment_basename_color $__color_path_basename

  if not [ -w "$current_dir" ]
    set segment_color $__color_path_nowrite
    set segment_basename_color $__color_path_nowrite_basename
  end

  __bobthefish_start_segment $segment_color

  set -l directory
  set -l parent

  switch "$current_dir"
    case /
      set directory '/'
    case "$HOME"
      set directory '~'
    case '*'
      set parent    (__bobthefish_pretty_parent "$current_dir")
      set parent    "$parent/"
      set directory (basename "$current_dir")
  end

  echo -n $parent
  set_color -b $segment_basename_color
  echo -ns $directory ' '
  set_color normal
end

function __bobthefish_finish_segments -S -d 'Close open prompt segments'
  if [ "$__bobthefish_current_bg" != '' ]
    set_color normal
    set_color $__bobthefish_current_bg
    echo -ns $__bobthefish_right_black_arrow_glyph ' '
  end

  set __bobthefish_current_bg
  set_color normal
end


# ===========================
# Theme components
# ===========================

function __bobthefish_prompt_status -S -a last_status -d 'Display symbols for a non zero exit status, root and background jobs'
  set -l nonzero
  set -l superuser

  # Last exit was nonzero
  [ $last_status -ne 0 ]
    and set nonzero $__bobthefish_nonzero_exit_glyph

  # if superuser (uid == 0)
  [ (id -u $USER) -eq 0 ]
    and set superuser $__bobthefish_superuser_glyph

  if [ "$nonzero" -o "$superuser" ]
    __bobthefish_start_segment $__color_initial_segment_exit
    if [ "$nonzero" ]
      set_color normal; set_color -b $__color_initial_segment_exit
      echo -ns $last_status ' '
    end

    if [ "$superuser" ]
      set_color normal; set_color -b $__color_initial_segment_su
      echo -n $__bobthefish_superuser_glyph
    end

    set_color normal
  end
end

function __bobthefish_prompt_git -S -a current_dir -d 'Display the actual git state'
  set -l dirty   (command git diff --no-ext-diff --quiet --exit-code; or echo -n '*')
  set -l staged  (command git diff --cached --no-ext-diff --quiet --exit-code; or echo -n '~')
  set -l stashed (command git rev-parse --verify --quiet refs/stash >/dev/null; and echo -n '$')
  set -l ahead   (__bobthefish_git_ahead)

  set -l new ''
  set -l show_untracked (command git config --bool bash.showUntrackedFiles)
  if [ "$show_untracked" != 'false' ]
    set new (command git ls-files --other --exclude-standard --directory --no-empty-directory)
    if [ "$new" ]
      set new '…'
    end
  end

  set -l flags "$dirty$staged$stashed$ahead$new"
  [ "$flags" ]
    and set flags " $flags"

  set -l flag_colors $__color_repo
  if [ "$dirty" ]
    set flag_colors $__color_repo_dirty
  else if [ "$staged" ]
    set flag_colors $__color_repo_staged
  end

  __bobthefish_path_segment $current_dir

  __bobthefish_start_segment $flag_colors
  echo -ns (__bobthefish_git_branch) $flags ' '
  set_color normal

  if [ "$theme_git_worktree_support" != 'yes' ]
    set -l project_pwd (__bobthefish_project_pwd $current_dir)
    if [ "$project_pwd" ]
      if [ -w "$PWD" ]
        __bobthefish_start_segment $__color_path
      else
        __bobthefish_start_segment $__color_path_nowrite
      end

      echo -ns $project_pwd ' '
    end
    return
  end

  set -l project_pwd (command git rev-parse --show-prefix ^/dev/null | sed -e 's#/$##')
  set -l work_dir (command git rev-parse --show-toplevel ^/dev/null)

  # only show work dir if it's a parent…
  if [ "$work_dir" ]
    switch $PWD/
      case $work_dir/\*
        set work_dir (echo $work_dir | sed -e "s#^$current_dir##")
      case \*
        set -e work_dir
    end
  end

  if [ "$project_pwd" -o "$work_dir" ]
    set -l colors $__color_path
    if not [ -w "$PWD" ]
      set colors $__color_path_nowrite
    end

    __bobthefish_start_segment $colors

    # handle work_dir != project dir
    if [ "$work_dir" ]
      set -l work_parent (dirname $work_dir | sed -e 's#^/##')
      if [ "$work_parent" ]
        echo -n "$work_parent/"
      end
      set_color normal; set_color -b $__color_repo_work_tree
      echo -n (basename $work_dir)
      set_color normal; set_color --background $colors
      [ "$project_pwd" ]
        and echo -n '/'
    end

    echo -ns $project_pwd ' '
  else
    set project_pwd (echo $PWD | sed -e "s#^$current_dir##" -e 's#^/##')
    if [ "$project_pwd" ]
      set -l colors $color_path
      if not [ -w "$PWD" ]
        set colors $color_path_nowrite
      end

      __bobthefish_start_segment $colors

      echo -ns $project_pwd ' '
    end
  end
end

function __bobthefish_prompt_dir -S -d 'Display a shortened form of the current directory'
  __bobthefish_path_segment "$PWD"
end

function __bobthefish_prompt_vi -S -d 'Display vi mode'
  switch $fish_bind_mode
    case default
      __bobthefish_start_segment $__color_vi_mode_default
      echo -n 'N'
    case insert
      __bobthefish_start_segment $__color_vi_mode_insert
      echo -n 'I'
    case visual
      __bobthefish_start_segment $__color_vi_mode_visual
      echo -n 'V'
  end
  set_color normal
end

# ===========================
# Apply theme
# ===========================

function fish_prompt -d 'bobthefish, a fish theme optimized for awesome'
  # Save the last status for later (do this before the `set` calls below)
  set -l last_status $status

  # Powerline glyphs
  set -l __bobthefish_branch_glyph            \uE0A0
  set -l __bobthefish_ln_glyph                \uE0A1
  set -l __bobthefish_padlock_glyph           \uE0A2
  set -l __bobthefish_right_black_arrow_glyph \uE0B0
  set -l __bobthefish_right_arrow_glyph       \uE0B1
  set -l __bobthefish_left_black_arrow_glyph  \uE0B2
  set -l __bobthefish_left_arrow_glyph        \uE0B3

  # Additional glyphs
  set -l __bobthefish_detached_glyph          \u27A6
  set -l __bobthefish_nonzero_exit_glyph      '! '
  set -l __bobthefish_superuser_glyph         '$ '

  # Colors: using the solarized-dark theme
  set -l base03  002b36
  set -l base02  073642
  set -l base01  586e75
  set -l base00  657b83
  set -l base0   839496
  set -l base1   93a1a1
  set -l base2   eee8d5
  set -l base3   fdf6e3
  set -l yellow  b58900
  set -l orange  cb4b16
  set -l red     dc322f
  set -l magenta d33682
  set -l violet  6c71c4
  set -l blue    268bd2
  set -l cyan    2aa198
  set -l green   859900

  set colorfg $base3

  set __color_initial_segment_exit     $base2 $red --bold
  set __color_initial_segment_su       $base2 $green --bold
  set __color_initial_segment_jobs     $base2 $blue --bold

  set __color_path                     $base02 $base0
  set __color_path_basename            $base02 $base1 --bold
  set __color_path_nowrite             $base02 $orange
  set __color_path_nowrite_basename    $base02 $orange --bold

  set __color_repo                     $green $colorfg
  set __color_repo_work_tree           $green $colorfg --bold
  set __color_repo_dirty               $red $colorfg
  set __color_repo_staged              $yellow $colorfg

  set __color_vi_mode_default          $blue $colorfg --bold
  set __color_vi_mode_insert           $green $colorfg --bold
  set __color_vi_mode_visual           $yellow $colorfg --bold

  set __color_username                 $base02 $blue
  set __color_rvm                      $red $colorfg --bold
  # end setting up Colors

  # Start each line with a blank slate
  set -l __bobthefish_current_bg

  __bobthefish_prompt_status $last_status
  __bobthefish_prompt_vi

  set -l git_root (__bobthefish_git_project_dir)

  if [ "$git_root" ]
    __bobthefish_prompt_git $git_root
  else
    __bobthefish_prompt_dir
  end

  __bobthefish_finish_segments
end
