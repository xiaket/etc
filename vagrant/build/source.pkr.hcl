source "qemu" "ubuntu" {
  boot_command = [
      "<spacebar><wait><spacebar><wait><spacebar><wait><spacebar><wait><spacebar><wait>",
      "e<wait>",
      "<down><down><down><end>",
      " autoinstall ds=nocloud-net\\;s=http://{{ .HTTPIP }}:{{ .HTTPPort }}/",
      "<f10>"
  ]
  disk_size         = "32768"
  iso_urls = [
    "ubuntu-22.04.3-live-server-amd64.iso"
  ]
  iso_checksum = "file:https://releases.ubuntu.com/jammy/SHA256SUMS"
  output_directory  = "output-ubuntu2204"
  shutdown_command  = "echo 'vagrant'|sudo -S shutdown -P now"
  http_directory = "http"
  ssh_password      = "vagrant"
  ssh_username      = "vagrant"
  ssh_wait_timeout  = "1h"
  ssh_timeout      = "1h"
  vm_name           = "ubuntu2204"
  use_default_display = false
  headless = true

  qemu_binary  = "qemu-system-x86_64"
  cpus = 4
  communicator     = "ssh"
  memory           = 8192
}
