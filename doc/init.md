# Extra steps

## Homebrew recepies

bash
bash-completion
colordiff
coreutils
ffmpeg
findutils
fzf
gawk
gnu-sed
gnu-tar
gnu-time
gnutls
go
jq
mtr
neovim
openssl
p7zip
packer
pandoc
procmail
python3
rbenv
saml2aws
shellcheck
sqlite
tig
tree
unrar
youtube-dl
wget

## Extra setups for homebrew

brew tap caskroom/cask
brew tap caskroom/fonts
brew tap versent/homebrew-taps

## Homebrew cask apps

dash
djview
dropbox
font-fira-code
hammerspoon
itsycal
grammarly
iina
kap
sloth
tad
typora

## Docker setup: curtesy of https://pilsniak.com/how-to-install-docker-on-mac-os-using-brew/

1. Install packages

```
brew install docker docker-compose docker-machine xhyve docker-machine-driver-xhyve
```

2. setup xhyve

```
sudo chown root:wheel $(brew --prefix)/opt/docker-machine-driver-xhyve/bin/docker-machine-driver-xhyve
sudo chmod u+s $(brew --prefix)/opt/docker-machine-driver-xhyve/bin/docker-machine-driver-xhyve
```

3. create docker machine.

```
docker-machine create default --driver xhyve --xhyve-experimental-nfs-share
```


## pip3 packages:

ansible
black
icdiff
neovim
psutil
ptpython
pyflakes
pygments
requests
sh
Snape
termcolor
troposphere
virtualenv

## go packages:

go get -u github.com/bndw/pick
go get -u github.com/mgutz/ansi

## rb packages:

gem install gollum

## Defaults to write

defaults write com.apple.dashboard mcx-disabled -bool TRUE;killall Dock
defaults write com.apple.dock autohide-fullscreen-delayed -bool FALSE; killall Dock
defaults write com.apple.finder FinderSounds -bool FALSE;killall Finder
defaults write -g InitialKeyRepeat -int 10
defaults write -g KeyRepeat -int 1

## Misc

mkdir -p ~/.xiaket/shared/{bitbucket,github,gitlab,openvpn,ssh}
mkdir -p ~/.config/
mkdir -p ~/.vim/backup
mkdir -p ~/.xiaket/var/{log,run,tmp}
mkdir -p ~/Library/Application\ Support/iTerm2/Scripts && ln -s ~/.xiaket/etc/bin/rename_tab.scpt ~/Library/Application\ Support/iTerm2/Scripts/rename_tab.scpt
mkdir -p ~/Library/Python/2.7/lib/python/site-packages && echo 'import site; site.addsitedir("/usr/local/lib/python2.7/site-packages")' >> ~/Library/Python/2.7/lib/python/site-packages/homebrew.pth
Install Alfred 2 manually since I do not have powerpack for 3.

## Symbolic links to create

~/.xiaket/etc/bashrc -> ~/.bashrc
~/.xiaket/etc/gitconfig -> ~/.gitconfig
~/.xiaket/etc/inputrc ~/.inputrc
~/.xiaket/etc/karabiner -> ~/.config/karabiner
~/.xiaket/etc/newsbeuter -> ~/.newsbeuter
~/.xiaket/etc/pythonrc ~/.pythonrc
~/.xiaket/etc/ptpython ~/.ptpython
~/.xiaket/etc/snape.json ~/.snape.json
~/.xiaket/etc/vim -> ~/.vim
~/.xiaket/etc/vim -> ~/.config/nvim
~/.xiaket/etc/vim/init.vim -> ~/.vimrc
~/.xiaket/shared/bitbucket -> ~/.BITBUCKET
~/.xiaket/shared/github -> ~/.GITHUB
~/.xiaket/shared/gitlab -> ~/.Gitlab
~/.xiaket/shared/ssh -> ~/.ssh
/usr/local/bin/python3 -> /usr/local/bin/python
/usr/local/bin/pip3 -> /usr/local/bin/pip

## Safari extensions

grammarly
ublock

## Ruby setups
sudo gem install bundler --no-ri --no-rdoc

## setup vim-plug
curl -fLo ~/.vim/autoload/plug.vim --create-dirs https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim

## Shine specific packages

pip install aws-google-auth

