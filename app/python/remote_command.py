# -*- coding: utf-8 -*-
""" Provides multi-threaded remote command execution. """
import paramiko
import threading
import sys
import socket
from getpass import getpass


class RemoteCommand:
    """ A wrapper for Paramiko."""
    def __init__(self, host, user, password):
        """
        :param host: The hostname or IP address of the remote host.
        :param user: The login username.
        """
        self.username = user
        self.hostname = host
        self.password = password
        if len(self.username) > 0 and len(self.hostname) > 0:
            if self.password is None:
                self.password = getpass(''.join(['SSH password for ', self.username, '@', self.hostname, ': ']))
            self.ssh = paramiko.SSHClient()
            """ Notice: AutoAddPolicy is not secure. Do not use outside of a lab environment. """
            self.ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            try:
                self.ssh.connect(self.hostname, username=self.username, password=self.password)
            except paramiko.AuthenticationException as error:
                print(error, self.username, file=sys.stderr, flush=True)
                exit(1)
            except paramiko.SSHException as error:
                print(error, file=sys.stderr, flush=True)
                exit(1)
            except socket.error as e:
                print(e.strerror, self.hostname, file=sys.stderr, flush=True)
                exit(1)
        else:
            print('Error: hostname, username, or password not provided to RemoteCommand().',
                  file=sys.stderr, flush=True)


class CommandThread (threading.Thread):
    """ Thread support for RemoteCommand. """
    def __init__(self, threadID, rcmd, command, callback):
        """
        :param threadID: The "thread identifier" of this thread.
        :param rcmd: The remote command shell.
        :param command: The command to execute remotely.
        """
        threading.Thread.__init__(self)
        self.threadID = threadID
        self.rcmd = rcmd
        self.command = command
        self.callback = callback

    def run(self):
        """ Method representing the thread’s activity. """
        stdin, stdout, stderr = self.rcmd.ssh.exec_command(self.command)
        self.callback(stdin, stdout, stderr)





