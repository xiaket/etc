packer {
  required_plugins {
    qemu = {
      version = ">= 1.0.1"
      source  = "github.com/hashicorp/qemu"
    }
  }
}

build {
  sources = ["source.qemu.ubuntu"]

  # Linux Shell scipts
  provisioner "shell" {
    environment_vars = [
        "HOME_DIR=/home/vagrant",
    ]
    execute_command = "echo 'vagrant' | {{ .Vars }} sudo -S -E bash -x '{{ .Path }}'"
    expect_disconnect = true
    scripts           = [
      "${path.root}/scripts/sshd.sh",
      "${path.root}/scripts/update.sh",
      "${path.root}/scripts/networking.sh",
      "${path.root}/scripts/sudo.sh",
      "${path.root}/scripts/vagrant.sh",
      "${path.root}/scripts/cleanup.sh",
    ]
  }

  # Convert machines to vagrant boxes
  post-processor "vagrant" {
    compression_level    = 9
    output               = "${path.root}/ubuntu-2204-x86_64.{{ .Provider }}.box"
  }
}
