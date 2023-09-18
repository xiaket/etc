Files/scripts in this folder build an ubuntu `x86_64` machine image for ubuntu, in the way I wanted it to be.


## Build

It's easy, just run build.sh


## Use

The following Vagrantfile should get you started:

```
Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu-2204"
  config.vm.hostname = "ubuntu"

  config.vm.provider "qemu" do |qe|
    qe.arch = "x86_64"
    qe.machine = "q35"
    qe.cpu = "max"
    qe.memory = "8G"
    qe.smp = "cpus=2,sockets=1,cores=2,threads=1"
    qe.net_device = "virtio-net-pci"
    qe.extra_qemu_args = %w(-accel tcg,thread=multi,tb-size=512)
    qe.qemu_dir = "/usr/local/share/qemu"
  end

  config.vm.synced_folder "/usr/local/share/qemu", "/mnt", type: "rsync"
  config.vm.synced_folder ".", "/vagrant", type: "smb", disabled: true
end
```
