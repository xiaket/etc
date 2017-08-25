# Extra steps

## Homebrew recepies

bash
bash-completion
coreutils
findutils
gawk
gnu-sed
gnu-tar
gnutls
jq
neovim
packer
procmail
python3
shellcheck
tig
vagrant-completion
wget

## Extra setups for homebrew

brew tap caskroom/cask

## Homebrew cask apps

dash
itsycal
grammarly
karabiner-elements
omnifocus
spectacle
steam
typora
vagrant
vagrant-manager
virtualbox
virtualbox-extension-pack

## pip3 packages:

ansible
neovim
pyflakes
requests
sh

## Defaults to write

defaults write com.apple.dashboard mcx-disabled -bool TRUE;killall Dock
defaults write com.apple.dock autohide-fullscreen-delayed -bool FALSE; killall Dock
defaults write com.apple.finder FinderSounds -bool FALSE;killall Finder
defaults write -g InitialKeyRepeat -int 10
defaults write -g KeyRepeat -int 1

## Misc

mkdir -p ~/.xiaket/shared/{bitbucket,github,ssh}
mkdir -p ~/.config/
mkdir -p ~/.vim/backup
mkdir -p ~/Library/Application\ Support/iTerm/Scripts && ln -s ~/.xiaket/etc/bin/rename_tab.scpt ~/Library/Application\ Support/iTerm/Scripts/rename_tab.scpt
mkdir -p ~/Library/Python/2.7/lib/python/site-packages && echo 'import site; site.addsitedir("/usr/local/lib/python2.7/site-packages")' >> ~/Library/Python/2.7/lib/python/site-packages/homebrew.pth
Install Alfred 2 manually since I do not have powerpack for 3.

## Symbolic links to create

~/.xiaket/etc/bashrc -> ~/.bashrc
~/.xiaket/etc/gitconfig -> ~/.gitconfig
~/.xiaket/etc/inputrc ~/.inputrc
~/.xiaket/etc/karabiner -> ~/.config/karabiner
~/.xiaket/etc/newsbeuter -> ~/.newsbeuter
~/.xiaket/etc/pythonrc ~/.pythonrc
~/.xiaket/etc/snape.json ~/.snape.json
~/.xiaket/etc/vim -> ~/.vim
~/.xiaket/etc/vim -> ~/.config/nvim 
~/.xiaket/etc/vim/init.vim -> ~/.vimrc
~/.xiaket/shared/bitbucket -> ~/.BITBUCKET
~/.xiaket/shared/github -> ~/.GITHUB
~/.xiaket/shared/ssh -> ~/.ssh
/usr/local/bin/python3 -> /usr/local/bin/python
/usr/local/bin/pip3 -> /usr/local/bin/pip

## Safari extensions

grammarly
ublock

## Ruby setups
sudo gem install bundler --no-ri --no-rdoc
