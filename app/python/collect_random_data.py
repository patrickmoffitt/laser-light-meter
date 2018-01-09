#!/usr/bin/env python3
# -*- coding: utf-8 -*-
""" Collect data from a tty device incident with a remote command. """

import argparse
import sys
import re
from itertools import product
from json import JSONEncoder, JSONDecoder, JSONDecodeError
from math import floor
from os import path, mkdir, getcwd, unlink
from random import seed, shuffle
from time import time, sleep
from read_terminal import ReadTerminal
from remote_command import RemoteCommand, CommandThread

parser = argparse.ArgumentParser()

parser.add_argument('host',
                    help='Remote hostname or IP address of the host firing the laser.')
""" The principle of least privilege is in effect.
    Only root can operate GPIO pins on the remote host.
    Likewise, root is required for stty on Darwin and Linux.
"""
parser.add_argument('-u', '--user', default='root',
                    help='Remote host user that can fire the laser. Defaults to root.')
parser.add_argument('password',
                    help="The remote host user's password. Remember to escape shell meta characters.")
parser.add_argument('su_password',
                    help="The local root password. Required for stty. Remember to escape shell meta characters.")
parser.add_argument('-d', '--data_dir', default=getcwd(),
                    help="The directory path for storing the training data. Defaults to the current working directory.")
parser.add_argument('-r', '--regex', default='^\}$',
                    help='A regular expression matching the end of data from the light meter.'
                         ' Defaults to ^\}$')
parser.add_argument('-t', '--tty', default='/dev/ttyACM0',
                    help='A tty device connected to the light meter. Defaults to /dev/ttyACM0.')
parser.add_argument('-b', '--baud', default=230400,
                    help='The baud rate of the tty. Defaults to 230,400.')
parser.add_argument('--min', default=20, type=int,
                    help='The minimum duty cycle. Defaults to 20.')
parser.add_argument('--max', default=80, type=int,
                    help='The maximum duty cycle. Defaults to 80.')
parser.add_argument('-s', '--samples', default=50, type=int,
                    help='The number os samples at each duty cycle. Defaults to 50.')
parser.add_argument('--random', default=1, type=int,
                    help='Whether to collect samples randomly. Defaults to true.')

args = parser.parse_args()


def get_config_by_duty(duty):
    """ Given a duty number return a config file name. """
    if duty < 20 or duty > 80 or isinstance(duty, float):
        print('Error: invalid value passed to get_config_by_duty(). '
              'The value must be an integer between 20 and 80 inclusive.',
              file=sys.stderr, flush=True)
        exit(1)
    else:
        return ''.join(['0', str(duty), '_test.json'])

driver_home = '/home/ubuntu/Development/cups_driver/src/CNC/'
driver = ''.join([driver_home, 'cups_driver'])
json_dir = ''.join([' -j ', driver_home, 'CNC/Configs/'])
fire_time = ' --fire-laser "0.0150"'

tty = ReadTerminal(regex=args.regex, tty=args.tty, baud=args.baud, su_pass=args.su_password)
rcmd = RemoteCommand(host=args.host, user=args.user, password=args.password)


def get_file_names(duty_min, duty_max, samples, random=1):
    """ Return and array of duty, folder, and filename.

        The array will be of size ((duty_max - duty_min) * samples).
        Shuffle option supports random data collection.
    """
    file_names = []
    model_id = repr(floor(time()))
    data_dir = path.join(args.data_dir, model_id)
    output = JSONEncoder().encode({'model_id': model_id, 'data_dir': data_dir})
    print(output, sep='', flush=True)
    mkdir(data_dir, mode=0o744)
    for duty, serial in product(range(duty_min, duty_max + 1), range(samples + 1)):
        folder = ''.join([data_dir, path.sep, str(duty), '_duty'])
        file_names.append([duty, folder, ''.join(['serial', '{:02d}'.format(serial), '.json'])])
    if random is 1:
        seed()
        shuffle(file_names)
    return file_names

samples = get_file_names(args.min, args.max, args.samples, random=args.random)
no_samples = 1
end = len(samples)


def status_update(filename, no_samples, end):
    """ Return a status update message. """
    head, tail = path.split(filename)
    directory = path.basename(head)
    percent_complete = repr(floor(round(no_samples / end, 2) * 100))
    return ''.join([percent_complete, '% complete. ', directory, '/', tail])


print()
print('┌───────────────────────┐')
print('│ Begin Data Collection │')
print('└───────────────────────┘\n', flush=True)

json_regex = r"^[\s\S]{1,6}(\{[\s\S]*)$"
tty.open()
for duty, folder, filename in samples:
    if not path.isdir(folder):
        mkdir(folder, mode=0o744)
    target = ''.join([folder, '/', filename])
    print(status_update(target, no_samples, end), flush=True)
    f = open(target, 'w')
    result = ''
    json_file = get_config_by_duty(duty)
    command = ''.join([driver, json_dir, json_file, fire_time])
    thread = CommandThread(1, rcmd, command, lambda *args: None).start()
    while True:
        if tty.in_waiting() > 0:
            line = tty.read()
            result += line
            if tty.regex.match(line):
                break
    try:
        # Verify the result.
        result = result.strip()
        JSONDecoder().decode(result)
        # Write the result into the file.
        f.write(result)
        f.close()
    except JSONDecodeError as e:
        json_data = re.search(json_regex, result, re.MULTILINE)
        if json_data:
            try:
                data = json_data.group().strip()
                JSONDecoder().decode(data)
                # Write the result into the file.
                f.write(data)
                f.close()
            except JSONDecodeError as e:
                print('Unrecoverable', e.msg, 'in', target, data, file=sys.stderr, flush=True)
                f.close()
                unlink(target)
        else:
            print('Unrecoverable', e.msg, 'in', target, result, file=sys.stderr, flush=True)
            f.close()
            unlink(target)

    # tty.close()
    del thread
    no_samples += 1
    sleep(2)

tty.close()

