#!/usr/bin/env python3
# -*- coding: utf-8 -*-
""" Execute JQ commands on remote hosts. """

from remote_command import RemoteCommand, CommandThread
import argparse

parser = argparse.ArgumentParser()

parser.add_argument('host',
                    help='Remote hostname or IP address.')
parser.add_argument('user',
                    help='Remote host user.')
parser.add_argument('-p', '--password',
                    help="The remote host user's password. Remember to escape shell meta characters.")
parser.add_argument('filter', help='The JQ filter.')
parser.add_argument('files', help='The files to filter; e.g. "file1 file2 ..."')
args = parser.parse_args()


def print_result(stdin, stdout, stderr):
    """ Print the results on stdout. """
    data = stdout.read().splitlines()
    for line in data:
        print(line.decode("utf-8"))
    print(flush=True)

command = ''.join(['jq ', "'", args.filter, "' ", args.files])
rcmd = RemoteCommand(host=args.host, user=args.user, password=args.password)

thread = CommandThread(1, rcmd, command, print_result).start()
