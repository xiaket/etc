#!/usr/bin/env python
#coding=utf-8
"""
Author:         Kent Xia/Xia Kai <kentx@pronto.net/xiaket@gmail.com>
Filename:       dnsd.py
Date created:   2016-08-02 16:18
Last modified:  2017-05-05 12:31
Modified by:    Kent Xia/Kai Xia <kentx@pronto.net/xiaket@gmail.com>

Description:
running as a dns server which will forward dns requests to another server
through socks proxy.
Changelog:

"""
import socket

import socks

# monkey patch socket in dnslib.
socks.setdefaultproxy(socks.PROXY_TYPE_SOCKS5, "127.0.0.1", 32768)
socket.socket = socks.socksocket
socks.socksocket.SOCK_STREAM = socket.SOCK_STREAM

from dnslib import DNSRecord
from dnslib.server import DNSServer, BaseResolver, DNSLogger


REAL_SERVER = "172.17.4.113"
LISTEN_ADDR = "10.30.0.1"


class SocksResolver(BaseResolver):
    def __init__(self, address, port):
        self.address = address
        self.port = port

    def resolve(self, request, handler):
        try:
            proxy_r = request.send(self.address, self.port, tcp=True)
        except socket.error:
            return DNSRecord()
        reply = DNSRecord.parse(proxy_r)
        return reply


def main():
    resolver = SocksResolver(REAL_SERVER, 53)
    logger = DNSLogger("request,reply,truncated,error", False)

    server = DNSServer(
        resolver, port=53, address=LISTEN_ADDR, logger=logger,
    )
    try:
        server.start()
    except KeyboardInterrupt:
        server.stop()

if __name__ == '__main__':
    main()
